import { UserPreferences, WatchlistItem } from '../types';
import { progressService } from './progress';
import { storageService } from './storage';
import { supabase } from './supabase';
import { tmdbService } from './tmdb';

export interface ProviderRecommendation {
  providerId: string;
  providerName: string;
  logoUrl?: string;
  score: number;
  availableContent: {
    movies: WatchlistItem[];
    tvShows: WatchlistItem[];
  };
  totalItems: number;
  estimatedValue: number; // Based on content available vs typical subscription cost
  totalCost: number;
  reasoning: string[];
  // New Advanced Metrics
  affinityScore: number; // 0-100 match with user taste
  efficiencyRatio: number; // Hours of entertainment per dollar
  estimatedCompletionMonths: number; // How long to watch everything
  hypeFactor: number; // 0-100 based on upcoming releases
  serendipityScore: number; // 0-100 based on hidden gems
}

export interface MonthlyRecommendation {
  month: string;
  year: number;
  topProviders: ProviderRecommendation[];
  totalWatchlistItems: number;
  coveragePercentage: number;
  estimatedMonthlySavings: number;
}

class RecommendationService {
  private providerCostsCache: { [key: string]: number } = {};
  private providerNamesCache: { [key: string]: string } = {};
  private lastCostsUpdate: number = 0;
  private readonly COSTS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  private async fetchProviderCosts(): Promise<void> {
    // Check if cache is valid
    if (Object.keys(this.providerCostsCache).length > 0 &&
      Date.now() - this.lastCostsUpdate < this.COSTS_CACHE_DURATION) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('provider_costs')
        .select('provider_id, provider_name, monthly_cost');

      if (error) throw error;

      if (data) {
        this.providerCostsCache = {};
        this.providerNamesCache = {};
        data.forEach(item => {
          this.providerCostsCache[item.provider_id] = item.monthly_cost;
          this.providerNamesCache[item.provider_id] = item.provider_name;
        });
        this.lastCostsUpdate = Date.now();
      }
    } catch (error) {
      console.error('Failed to fetch provider costs:', error);
      // Fallback to some defaults if fetch fails
      if (Object.keys(this.providerCostsCache).length === 0) {
        this.providerCostsCache = {
          '8': 15.49, '9': 14.98, '337': 13.99, '384': 15.99, '15': 14.99,
          '2': 6.99, '283': 5.99, '531': 9.99, '387': 4.99, '350': 12.99
        };
      }
    }
  }

  async generateMonthlyRecommendations(forceRefresh = false): Promise<MonthlyRecommendation> {
    try {
      // Try to get user from session first (more reliable)
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (!user) {
        console.log('[Recommendations] User not authenticated yet, returning empty recommendations');
        return this.getEmptyRecommendation();
      }
      
      console.log('[Recommendations] User authenticated, generating recommendations for user:', user.id);

      const currentDate = new Date();
      const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
      const currentYear = currentDate.getFullYear();

      // 1. Check DB cache if not forced
      if (!forceRefresh) {
        const { data: cachedRecs, error } = await supabase
          .from('recommendations')
          .select('data')
          .eq('user_id', user.id)
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .single();

        if (cachedRecs && cachedRecs.data) {
          return cachedRecs.data as MonthlyRecommendation;
        }
      }

      await this.fetchProviderCosts();

      // Get user's watchlist
      const watchlist = await storageService.getWatchlist();
      const unwatchedItems = watchlist.filter(item => !item.watched);

      console.log('[Recommendations] Watchlist analysis:', {
        totalItems: watchlist.length,
        unwatchedItems: unwatchedItems.length,
        watchedItems: watchlist.filter(item => item.watched).length,
      });

      if (unwatchedItems.length === 0) {
        console.log('[Recommendations] No unwatched items in watchlist, returning empty recommendations');
        return this.getEmptyRecommendation();
      }

      // Get user preferences for advanced scoring
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const userPrefs = preferences as UserPreferences | null;
      const genreAffinity = await this.analyzeUserGenres(watchlist);

      // Get streaming options for all unwatched items
      const providerAnalysis = new Map<string, {
        provider: { id: string; name: string; logoUrl?: string };
        content: WatchlistItem[];
        totalScore: number;
        totalRuntimeMins: number;
      }>();

      // Analyze each item in the watchlist
      for (const item of unwatchedItems) {
        try {
          // Fetch from Service (handles Supabase Cache + API)
          const streamingOptions = await tmdbService.getWatchProviders(item.id, item.type);

          console.log(`[Recommendations] Streaming options for "${item.title}":`, {
            totalOptions: streamingOptions?.length || 0,
            providers: streamingOptions?.map(opt => ({ id: opt.service.id, name: opt.service.name, type: opt.type })) || [],
          });

          // Update Local Cache (optional, for offline support)
          item.providerCache = {
            timestamp: Date.now(),
            data: streamingOptions,
            source: 'tmdb'
          };
          storageService.updateWatchlistItem(item).catch(err =>
            console.warn(`Failed to update local cache for ${item.title}:`, err)
          );

          if (!streamingOptions) continue;

          // Focus on subscription services (flatrate) for monthly recommendations
          const subscriptionServices = streamingOptions.filter(option => option.type === 'flatrate');

          for (const option of subscriptionServices) {
            const providerId = option.service.id;
            const providerName = option.service.name;
            const logoUrl = option.service.imageSet?.darkThemeImage;

            if (!providerAnalysis.has(providerId)) {
              providerAnalysis.set(providerId, {
                provider: { id: providerId, name: providerName, logoUrl },
                content: [],
                totalScore: 0,
                totalRuntimeMins: 0,
              });
            }

            const analysis = providerAnalysis.get(providerId)!;
            analysis.content.push(item);

            // Calculate accurate runtime based on progress
            let runtime = 0;
            if (item.type === 'movie') {
              runtime = 120; // Default 2h for movies if details missing
            } else {
              // For TV Shows, check progress
              const progress = await progressService.getShowProgress(item.id);
              const watchedEpisodes = progress?.total_watched_episodes || 0;
              const estimatedTotalEpisodes = 10;
              const remainingEpisodes = Math.max(0, estimatedTotalEpisodes - watchedEpisodes);
              runtime = remainingEpisodes * 45; // 45m avg
            }

            analysis.totalRuntimeMins += runtime;

            // Score based on item popularity and user rating
            const popularityScore = Math.min(item.vote_average / 10, 1);
            const recencyScore = this.getRecencyScore(item);
            analysis.totalScore += (popularityScore + recencyScore) / 2;
          }
        } catch (error) {
          console.warn(`Failed to get streaming options for ${item.title}:`, error);
        }
      }

      // Convert analysis to recommendations
      const recommendations: ProviderRecommendation[] = [];

      for (const [providerId, analysis] of Array.from(providerAnalysis.entries())) {
        const movies = analysis.content.filter(item => item.type === 'movie');
        const tvShows = analysis.content.filter(item => item.type === 'tv');

        const totalItems = analysis.content.length;

        // Calculate costs and values
        const monthlyCost = this.providerCostsCache[providerId] || 12.99; // Default fallback
        const estimatedValue = totalItems * 3.99; // Assume $3.99 rental value per item

        const efficiencyRatio = (analysis.totalRuntimeMins / 60) / monthlyCost;
        const estimatedCompletionMonths = this.calculateCompletionTime(analysis.totalRuntimeMins, userPrefs?.weekly_watch_hours || 10);
        const hypeFactor = 0; // Placeholder for now (requires upcoming API)
        const serendipityScore = 0; // Placeholder for now
        const affinityScore = this.calculateAffinityScore(analysis.content, genreAffinity);

        // Weighted Score
        // Base score from content quality + Affinity + Efficiency
        const baseScore = (analysis.totalScore / totalItems) * 100;
        const finalScore = (baseScore * 0.4) + (affinityScore * 0.3) + (Math.min(efficiencyRatio, 5) * 20 * 0.3);

        const reasoning = this.generateReasoning(
          analysis.provider.name,
          totalItems,
          movies.length,
          tvShows.length,
          estimatedValue,
          efficiencyRatio,
          estimatedCompletionMonths
        );

        recommendations.push({
          providerId,
          providerName: analysis.provider.name,
          logoUrl: analysis.provider.logoUrl,
          score: finalScore,
          availableContent: { movies, tvShows },
          totalItems,
          estimatedValue,
          totalCost: monthlyCost,
          reasoning,
          affinityScore,
          efficiencyRatio,
          estimatedCompletionMonths,
          hypeFactor,
          serendipityScore
        });
      }

      // Sort by score (highest first)
      recommendations.sort((a, b) => b.score - a.score);

      // Calculate coverage and savings
      const topProviders = recommendations.slice(0, 3);
      const coveredItems = new Set<string>();

      topProviders.forEach(provider => {
        provider.availableContent.movies.forEach(item => coveredItems.add(`${item.type}-${item.id}`));
        provider.availableContent.tvShows.forEach(item => coveredItems.add(`${item.type}-${item.id}`));
      });

      const coveragePercentage = (coveredItems.size / unwatchedItems.length) * 100;
      const estimatedMonthlySavings = this.calculateSavings(topProviders);

      const result: MonthlyRecommendation = {
        month: currentMonth,
        year: currentYear,
        topProviders: recommendations,
        totalWatchlistItems: unwatchedItems.length,
        coveragePercentage,
        estimatedMonthlySavings,
      };

      // Save to DB
      const { error: upsertError } = await supabase
        .from('recommendations')
        .upsert({
          user_id: user.id,
          month: currentMonth,
          year: currentYear,
          data: result,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, month, year' });

      if (upsertError) {
        console.error('Failed to save recommendations to DB:', upsertError);
      }

      return result;

    } catch (error) {
      console.error('Error generating recommendations:', error);
      return this.getEmptyRecommendation();
    }
  }

  private async analyzeUserGenres(watchlist: WatchlistItem[]): Promise<Map<number, number>> {
    const genreCounts = new Map<number, number>();
    // In a real app, we'd need genre_ids on WatchlistItem or fetch details.
    // For now, we'll assume we might not have them and return empty or mock.
    return genreCounts;
  }

  private calculateAffinityScore(items: WatchlistItem[], genreAffinity: Map<number, number>): number {
    // Placeholder: Return a random score between 50 and 100 for demo purposes
    return 50 + Math.random() * 50;
  }

  private calculateCompletionTime(totalRuntimeMins: number, weeklyHours: number): number {
    const totalHours = totalRuntimeMins / 60;
    const monthlyHours = weeklyHours * 4.33; // Average weeks per month
    return Math.ceil(totalHours / monthlyHours);
  }

  private getRecencyScore(item: WatchlistItem): number {
    const releaseDate = item.release_date || item.first_air_date;
    if (!releaseDate) return 0.5;

    const release = new Date(releaseDate);
    const now = new Date();
    const monthsOld = (now.getTime() - release.getTime()) / (1000 * 60 * 60 * 24 * 30);

    // More recent content gets higher score
    if (monthsOld < 6) return 1.0;
    if (monthsOld < 12) return 0.8;
    if (monthsOld < 24) return 0.6;
    return 0.4;
  }

  private generateReasoning(
    providerName: string,
    totalItems: number,
    movies: number,
    tvShows: number,
    estimatedValue: number,
    efficiencyRatio: number,
    monthsToWatch: number
  ): string[] {
    const reasoning: string[] = [];

    if (totalItems >= 5) {
      reasoning.push(`${totalItems} items from your watchlist`);
    } else {
      reasoning.push(`${totalItems} item${totalItems > 1 ? 's' : ''} available`);
    }

    if (efficiencyRatio > 2) {
      reasoning.push(`High Value: ${(efficiencyRatio).toFixed(1)} hours of entertainment per $1`);
    }

    if (monthsToWatch > 1) {
      reasoning.push(`Enough content for ${monthsToWatch} months`);
    } else {
      reasoning.push(`Perfect for a 1-month binge`);
    }

    if (estimatedValue > 20) {
      reasoning.push(`Save ~$${estimatedValue.toFixed(0)} vs rentals`);
    }

    return reasoning;
  }

  private calculateSavings(providers: ProviderRecommendation[]): number {
    if (providers.length === 0) return 0;

    // Calculate potential savings by subscribing to top provider vs renting individually
    const topProvider = providers[0];
    const monthlyCost = this.providerCostsCache[topProvider.providerId] || 12.99;
    const rentalCost = topProvider.totalItems * 3.99; // Assume $3.99 per rental

    return Math.max(0, rentalCost - monthlyCost);
  }

  private getEmptyRecommendation(): MonthlyRecommendation {
    const currentDate = new Date();
    return {
      month: currentDate.toLocaleString('default', { month: 'long' }),
      year: currentDate.getFullYear(),
      topProviders: [],
      totalWatchlistItems: 0,
      coveragePercentage: 0,
      estimatedMonthlySavings: 0,
    };
  }

  async getProviderDetails(providerId: string): Promise<{ name: string; cost: number; logoUrl?: string } | null> {
    await this.fetchProviderCosts();
    const cost = this.providerCostsCache[providerId];
    if (!cost) return null;

    return {
      name: this.getProviderName(providerId),
      cost,
    };
  }

  private getProviderName(providerId: string): string {
    return this.providerNamesCache[providerId] || 'Unknown Provider';
  }
}

export const recommendationService = new RecommendationService();