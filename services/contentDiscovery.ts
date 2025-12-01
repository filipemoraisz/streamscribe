import { tmdbService } from './tmdb';
import { Movie, TVShow, LeavingSoonItem } from '../types';
import { supabase } from './supabase';

/**
 * ContentDiscoveryService
 * 
 * Handles content discovery features including "New This Week" and "Leaving Soon" sections.
 * Provides methods to fetch and filter recently released content and expiring streaming availability.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3
 */
class ContentDiscoveryService {
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  /**
   * Get content released within the last 7 days
   * 
   * Requirements:
   * - 9.1: Display "New This Week" section on home screen
   * - 9.2: Include content released within the last 7 days
   * - 9.3: Show both movies and TV shows
   * - 9.4: Order by release date descending (most recent first)
   */
  async getNewThisWeek(): Promise<(Movie | TVShow)[]> {
    const CACHE_KEY = 'new_this_week';
    
    // Check cache first
    const cached = this.cache.get(CACHE_KEY);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Calculate date range (last 7 days)
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      const todayStr = this.formatDate(today);
      const sevenDaysAgoStr = this.formatDate(sevenDaysAgo);

      // Fetch both movies and TV shows released in the last 7 days
      const [movies, tvShows] = await Promise.all([
        this.getNewMovies(sevenDaysAgoStr, todayStr),
        this.getNewTVShows(sevenDaysAgoStr, todayStr),
      ]);

      // Combine and sort by release date descending
      const allContent = [...movies, ...tvShows];
      const sortedContent = this.sortByReleaseDate(allContent);

      // Cache the result
      this.cache.set(CACHE_KEY, { data: sortedContent, timestamp: Date.now() });

      return sortedContent;
    } catch (error) {
      console.error('Error fetching new this week content:', error);
      return [];
    }
  }

  /**
   * Fetch movies released within the specified date range
   * Uses TMDB discover endpoint with release date filters
   */
  private async getNewMovies(startDate: string, endDate: string): Promise<Movie[]> {
    try {
      const response = await fetch(
        `${tmdbService['baseURL']}/discover/movie?api_key=${tmdbService['apiKey']}&primary_release_date.gte=${startDate}&primary_release_date.lte=${endDate}&sort_by=primary_release_date.desc`
      );

      if (!response.ok) {
        console.warn('Failed to fetch new movies');
        return [];
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error fetching new movies:', error);
      return [];
    }
  }

  /**
   * Fetch TV shows that first aired within the specified date range
   * Uses TMDB discover endpoint with air date filters
   */
  private async getNewTVShows(startDate: string, endDate: string): Promise<TVShow[]> {
    try {
      const response = await fetch(
        `${tmdbService['baseURL']}/discover/tv?api_key=${tmdbService['apiKey']}&first_air_date.gte=${startDate}&first_air_date.lte=${endDate}&sort_by=first_air_date.desc`
      );

      if (!response.ok) {
        console.warn('Failed to fetch new TV shows');
        return [];
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error fetching new TV shows:', error);
      return [];
    }
  }

  /**
   * Sort content by release date descending (most recent first)
   * Handles both movies (release_date) and TV shows (first_air_date)
   * 
   * Requirement 9.4: Order by release date descending
   */
  private sortByReleaseDate(content: (Movie | TVShow)[]): (Movie | TVShow)[] {
    return content.sort((a, b) => {
      const dateA = this.getReleaseDateString(a);
      const dateB = this.getReleaseDateString(b);

      // Sort descending (most recent first)
      return dateB.localeCompare(dateA);
    });
  }

  /**
   * Get release date string from either Movie or TVShow
   */
  private getReleaseDateString(item: Movie | TVShow): string {
    if ('release_date' in item) {
      return item.release_date || '';
    } else if ('first_air_date' in item) {
      return item.first_air_date || '';
    }
    return '';
  }

  /**
   * Format date to YYYY-MM-DD string for TMDB API
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get content leaving streaming services within the next 30 days
   * 
   * Requirements:
   * - 10.1: Display "Leaving Soon" section for content leaving within 30 days
   * - 10.2: Show departure date for each item
   * - 10.3: Sort by earliest departure date (soonest first)
   * 
   * @returns Array of LeavingSoonItem sorted by departure date
   */
  async getLeavingSoon(): Promise<LeavingSoonItem[]> {
    const CACHE_KEY = 'leaving_soon';
    
    // Check cache first
    const cached = this.cache.get(CACHE_KEY);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('No authenticated user for leaving soon content');
        return [];
      }

      // Get user's subscribed services
      const { data: preferences, error: prefsError } = await supabase
        .from('user_preferences')
        .select('subscribed_services')
        .eq('user_id', user.id)
        .single();

      if (prefsError || !preferences?.subscribed_services?.length) {
        console.warn('No subscribed services found for user');
        return [];
      }

      // Calculate date range (next 30 days)
      const today = new Date();
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      // Query streaming_availability_changes table for content leaving soon
      const { data: changes, error: changesError } = await supabase
        .from('streaming_availability_changes')
        .select('*')
        .eq('change_type', 'leaving_soon')
        .in('service_id', preferences.subscribed_services)
        .not('leaving_date', 'is', null)
        .gte('leaving_date', today.toISOString())
        .lte('leaving_date', thirtyDaysFromNow.toISOString())
        .order('leaving_date', { ascending: true });

      if (changesError) {
        console.error('Error fetching leaving soon content:', changesError);
        return [];
      }

      if (!changes || changes.length === 0) {
        return [];
      }

      // Check which items are in user's watchlist
      const tmdbIds = changes.map(c => c.tmdb_id);
      const { data: watchlistItems } = await supabase
        .from('watchlists')
        .select('tmdb_id, media_type')
        .eq('user_id', user.id)
        .in('tmdb_id', tmdbIds);

      const watchlistSet = new Set(
        watchlistItems?.map(w => `${w.tmdb_id}-${w.media_type}`) || []
      );

      // Fetch full details from TMDB for each item
      const leavingSoonItems = await Promise.all(
        changes.map(async (change) => {
          try {
            const details = await this.fetchMediaDetails(change.tmdb_id, change.media_type);
            if (!details) return null;

            const daysRemaining = this.calculateDaysRemaining(change.leaving_date);
            const isInWatchlist = watchlistSet.has(`${change.tmdb_id}-${change.media_type}`);

            const item: LeavingSoonItem = {
              id: change.tmdb_id,
              type: change.media_type as 'movie' | 'tv',
              title: change.media_type === 'movie' 
                ? (details as Movie).title 
                : (details as TVShow).name,
              poster_path: details.poster_path,
              backdrop_path: details.backdrop_path,
              vote_average: details.vote_average,
              departureDate: change.leaving_date,
              providerName: change.service_name,
              daysRemaining,
              isInWatchlist,
              // Include additional fields from Movie or TVShow
              ...(change.media_type === 'movie' 
                ? { release_date: (details as Movie).release_date }
                : { first_air_date: (details as TVShow).first_air_date }
              ),
            };

            return item;
          } catch (error) {
            console.error(`Error fetching details for ${change.media_type} ${change.tmdb_id}:`, error);
            return null;
          }
        })
      );

      // Filter out null items and sort by earliest departure date
      const validItems = leavingSoonItems
        .filter((item): item is LeavingSoonItem => item !== null)
        .sort((a, b) => {
          // Sort by departure date ascending (soonest first)
          return new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime();
        });

      // Cache the result
      this.cache.set(CACHE_KEY, { data: validItems, timestamp: Date.now() });

      return validItems;
    } catch (error) {
      console.error('Error fetching leaving soon content:', error);
      return [];
    }
  }

  /**
   * Fetch media details from TMDB
   * @private
   */
  private async fetchMediaDetails(tmdbId: number, mediaType: string): Promise<Movie | TVShow | null> {
    try {
      const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
      const response = await fetch(
        `${tmdbService['baseURL']}/${endpoint}/${tmdbId}?api_key=${tmdbService['apiKey']}`
      );

      if (!response.ok) {
        console.warn(`Failed to fetch ${mediaType} details for ID ${tmdbId}`);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching ${mediaType} details:`, error);
      return null;
    }
  }

  /**
   * Calculate days remaining until departure date
   * @private
   */
  private calculateDaysRemaining(departureDate: string): number {
    const today = new Date();
    const departure = new Date(departureDate);
    const diffTime = departure.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays); // Ensure non-negative
  }

  /**
   * Clear cache for new this week content
   */
  clearNewThisWeekCache(): void {
    this.cache.delete('new_this_week');
  }

  /**
   * Clear cache for leaving soon content
   */
  clearLeavingSoonCache(): void {
    this.cache.delete('leaving_soon');
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.cache.clear();
  }
}

export const contentDiscoveryService = new ContentDiscoveryService();
