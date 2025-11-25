import { WatchlistItem } from '../types';
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

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
          console.log('Using cached recommendations from DB');
          return cachedRecs.data as MonthlyRecommendation;
        }
      }

      console.log('Generating new recommendations...');
      await this.fetchProviderCosts();

      // Get user's watchlist
      const watchlist = await storageService.getWatchlist();
      const unwatchedItems = watchlist.filter(item => !item.watched);

      if (unwatchedItems.length === 0) {
        return this.getEmptyRecommendation();
      }

      // Get streaming options for all unwatched items
      const providerAnalysis = new Map<string, {
        provider: { id: string; name: string; logoUrl?: string };
        content: WatchlistItem[];
        totalScore: number;
      }>();

      // Analyze each item in the watchlist
      for (const item of unwatchedItems) {
        try {
          // Fetch from Service (handles Supabase Cache + API)
          const streamingOptions = await tmdbService.getWatchProviders(item.id, item.type);

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
              });
            }

            const analysis = providerAnalysis.get(providerId)!;
            analysis.content.push(item);

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

      for (const [providerId, analysis] of providerAnalysis) {
        const movies = analysis.content.filter(item => item.type === 'movie');
        const tvShows = analysis.content.filter(item => item.type === 'tv');

        const totalItems = analysis.content.length;
        const averageScore = analysis.totalScore / totalItems;

        // Calculate estimated value based on content available vs subscription cost
        const monthlyCost = this.providerCostsCache[providerId] || 12.99;
        const contentValue = totalItems * 3.99; // Assume $3.99 per rental as baseline
        const estimatedValue = Math.max(0, contentValue - monthlyCost);

        const reasoning = this.generateReasoning(analysis.provider.name, totalItems, movies.length, tvShows.length, estimatedValue);

        recommendations.push({
          providerId,
          providerName: analysis.provider.name,
          logoUrl: analysis.provider.logoUrl,
          score: averageScore * totalItems, // Weight by content amount
          availableContent: { movies, tvShows },
          totalItems,
          estimatedValue,
          totalCost: monthlyCost,
          reasoning,
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
      } else {
        console.log('Saved recommendations to DB');
      }

      return result;

    } catch (error) {
      console.error('Error generating recommendations:', error);
      return this.getEmptyRecommendation();
    }
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

  private generateReasoning(providerName: string, totalItems: number, movies: number, tvShows: number, estimatedValue: number): string[] {
    const reasoning: string[] = [];

    if (totalItems >= 5) {
      reasoning.push(`${totalItems} items from your watchlist available`);
    } else if (totalItems >= 3) {
      reasoning.push(`${totalItems} watchlist items available`);
    } else {
      reasoning.push(`${totalItems} item${totalItems > 1 ? 's' : ''} available`);
    }

    if (movies > 0 && tvShows > 0) {
      reasoning.push(`Mix of ${movies} movie${movies > 1 ? 's' : ''} and ${tvShows} show${tvShows > 1 ? 's' : ''}`);
    } else if (movies > 0) {
      reasoning.push(`${movies} movie${movies > 1 ? 's' : ''} available`);
    } else if (tvShows > 0) {
      reasoning.push(`${tvShows} TV show${tvShows > 1 ? 's' : ''} available`);
    }

    if (estimatedValue > 20) {
      reasoning.push(`Great value - save ~$${estimatedValue.toFixed(0)} vs individual rentals`);
    } else if (estimatedValue > 10) {
      reasoning.push(`Good value vs individual rentals`);
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