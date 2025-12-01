import { supabase } from './supabase';
import { tmdbService } from './tmdb';
import { tasteProfileService } from './tasteProfileService';
import { progressService } from './progress';
import { Movie, TVShow, BecauseYouWatchedSection } from '../types';

interface WatchedItem {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  watchedDate: string;
  rating: number;
}

/**
 * PersonalizationService
 * 
 * Generates "Because You Watched" recommendation sections based on user's watch history.
 * Leverages TasteProfileService for scoring and analysis.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
class PersonalizationService {
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (same as taste profile)
  private cache: Map<string, { sections: BecauseYouWatchedSection[]; timestamp: number }> = new Map();

  /**
   * Generate "Because You Watched [Title]" sections
   * 
   * Requirements:
   * - 5.1: Generate sections when user has watched at least one item
   * - 5.2: Use genre, cast, and rating similarity
   * - 5.3: Show maximum of 3 sections
   * - 5.4: Prioritize recently watched and highly rated items
   * - 5.5: Don't display if insufficient watch history
   */
  async generateBecauseYouWatched(userId: string): Promise<BecauseYouWatchedSection[]> {
    // Check cache first
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.sections;
    }

    try {
      // Get watch history from multiple sources
      const watchedItems = await this.getWatchHistory(userId);

      // Requirement 5.5: Return empty if insufficient watch history
      if (watchedItems.length === 0) {
        return [];
      }

      // Requirement 5.4: Select top 3 source items (recently watched + highly rated)
      const sourceItems = this.selectSourceItems(watchedItems, 3);

      // Build taste profile for scoring
      const tasteProfile = await tasteProfileService.buildTasteProfile(userId);

      // Generate sections for each source item
      const sections: BecauseYouWatchedSection[] = [];

      for (const sourceItem of sourceItems) {
        try {
          // Requirement 5.2: Find similar content based on genre, cast, rating
          const similarContent = await this.getSimilarContent(
            sourceItem.id,
            sourceItem.type,
            tasteProfile
          );

          if (similarContent.length > 0) {
            sections.push({
              sourceId: sourceItem.id,
              sourceTitle: sourceItem.title,
              sourceType: sourceItem.type,
              items: similarContent,
            });
          }

          // Requirement 5.3: Maximum of 3 sections
          if (sections.length >= 3) {
            break;
          }
        } catch (error) {
          console.error(`Error generating section for ${sourceItem.title}:`, error);
          // Continue with other source items
        }
      }

      // Cache the result
      this.cache.set(userId, { sections, timestamp: Date.now() });

      return sections;
    } catch (error) {
      console.error('Error generating Because You Watched sections:', error);
      return [];
    }
  }

  /**
   * Get watch history from episode progress and watchlist
   * Combines TV shows from episode_progress and movies from watchlist
   */
  private async getWatchHistory(userId: string): Promise<WatchedItem[]> {
    const watchedItems: WatchedItem[] = [];

    try {
      // Get TV shows from episode progress
      const showsProgress = await progressService.getAllShowsProgress();
      
      for (const showProgress of showsProgress) {
        // Only include shows with significant progress (at least 3 episodes watched)
        if (showProgress.total_watched_episodes >= 3) {
          try {
            const showDetails = await tmdbService.getTVShowDetails(showProgress.show_id);
            watchedItems.push({
              id: showProgress.show_id,
              type: 'tv',
              title: showDetails.name,
              watchedDate: showProgress.last_watched_date,
              rating: showDetails.vote_average,
            });
          } catch (error) {
            console.error(`Error fetching show details for ${showProgress.show_id}:`, error);
          }
        }
      }

      // Get watched movies from watchlist
      const { data: watchedMovies } = await supabase
        .from('watchlists')
        .select('tmdb_id, title, updated_at')
        .eq('user_id', userId)
        .eq('media_type', 'movie')
        .eq('watched', true)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (watchedMovies) {
        for (const movie of watchedMovies) {
          try {
            const movieDetails = await tmdbService.getMovieDetails(movie.tmdb_id);
            watchedItems.push({
              id: movie.tmdb_id,
              type: 'movie',
              title: movie.title,
              watchedDate: movie.updated_at,
              rating: movieDetails.vote_average,
            });
          } catch (error) {
            console.error(`Error fetching movie details for ${movie.tmdb_id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error getting watch history:', error);
    }

    return watchedItems;
  }

  /**
   * Select top source items for "Because You Watched" sections
   * Prioritizes recently watched and highly rated content
   * 
   * Requirement 5.4: Prioritize recently watched and highly rated items
   */
  private selectSourceItems(watchedItems: WatchedItem[], limit: number): WatchedItem[] {
    // Score each item based on recency and rating
    const scoredItems = watchedItems.map(item => {
      // Recency score (0-50): More recent = higher score
      const daysSinceWatched = Math.floor(
        (Date.now() - new Date(item.watchedDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      const recencyScore = Math.max(0, 50 - daysSinceWatched);

      // Rating score (0-50): Higher rating = higher score
      const ratingScore = (item.rating / 10) * 50;

      const totalScore = recencyScore + ratingScore;

      return { ...item, score: totalScore };
    });

    // Sort by score and return top items
    scoredItems.sort((a, b) => b.score - a.score);
    return scoredItems.slice(0, limit);
  }

  /**
   * Get similar content using TMDB API and taste profile scoring
   * 
   * Requirement 5.2: Use genre, cast, and rating similarity
   */
  private async getSimilarContent(
    itemId: number,
    itemType: 'movie' | 'tv',
    tasteProfile: any
  ): Promise<(Movie | TVShow)[]> {
    try {
      // Fetch similar content from TMDB
      const endpoint = itemType === 'movie' 
        ? `/movie/${itemId}/similar`
        : `/tv/${itemId}/similar`;
      
      const response = await fetch(
        `${tmdbService['baseURL']}${endpoint}?api_key=${tmdbService['apiKey']}`
      );

      if (!response.ok) {
        console.warn(`Failed to fetch similar content for ${itemType} ${itemId}`);
        return [];
      }

      const data = await response.json();
      const similarItems: (Movie | TVShow)[] = data.results || [];

      // Score and filter items using taste profile
      const scoredItems = similarItems
        .map(item => ({
          item,
          score: tasteProfileService.calculateTasteScore(item, tasteProfile),
        }))
        .filter(({ score }) => score >= 50) // Only include items with decent taste match
        .sort((a, b) => b.score - a.score)
        .slice(0, 10) // Top 10 recommendations per section
        .map(({ item }) => item);

      return scoredItems;
    } catch (error) {
      console.error(`Error fetching similar content for ${itemType} ${itemId}:`, error);
      return [];
    }
  }

  /**
   * Clear cache for a specific user
   */
  clearCache(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.cache.clear();
  }
}

export const personalizationService = new PersonalizationService();
