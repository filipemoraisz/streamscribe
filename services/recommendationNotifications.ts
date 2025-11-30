import { supabase } from './supabase';
import { recommendationService } from './recommendations';
import { tmdbService } from './tmdb';
import { storageService } from './storage';
import type { 
  NotificationPayload, 
  NotificationPreferences, 
  WatchlistItem,
  TVShow,
  Movie 
} from '../types';

export interface RecommendationNotification extends NotificationPayload {
  type: 'recommendation';
  data: {
    recommendationType: 'new_content' | 'weekly_digest' | 'trending' | 'genre_match';
    contentId?: number;
    contentType?: 'movie' | 'tv';
    contentTitle?: string;
    genreIds?: number[];
    rating?: number;
    streamingServices?: string[];
    digestItems?: Array<{
      id: number;
      type: 'movie' | 'tv';
      title: string;
      rating: number;
      genres: string[];
    }>;
  };
}

export interface ContentRecommendation {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  overview: string;
  poster_path: string | null;
  vote_average: number;
  genre_ids: number[];
  release_date?: string;
  first_air_date?: string;
  popularity: number;
  streaming_services: string[];
  recommendation_score: number;
  recommendation_reason: string[];
}

class RecommendationNotificationService {
  private readonly HIGH_RATING_THRESHOLD = 8.0;
  private readonly TRENDING_POPULARITY_THRESHOLD = 100;
  private readonly WEEKLY_DIGEST_DAY = 1; // Monday
  private readonly MAX_DIGEST_ITEMS = 5;

  /**
   * Process new content recommendations and generate notifications
   */
  async processNewContentRecommendations(): Promise<RecommendationNotification[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      console.log('Processing new content recommendations...');

      // Get user preferences to understand their taste
      const userPrefs = await this.getUserPreferences(user.id);
      if (!userPrefs) return [];

      // Get user's watchlist to analyze preferences
      const watchlist = await storageService.getWatchlist();
      const genrePreferences = await this.analyzeUserGenrePreferences(watchlist);

      // Get new highly-rated content from TMDB
      const newContent = await this.getNewHighRatedContent();
      
      // Filter content based on user preferences
      const filteredContent = await this.filterContentByPreferences(
        newContent, 
        genrePreferences, 
        userPrefs.subscribed_services
      );

      // Generate notifications for filtered content
      const notifications: RecommendationNotification[] = [];

      for (const content of filteredContent) {
        const notification = await this.createContentRecommendationNotification(
          user.id,
          content,
          genrePreferences
        );
        if (notification) {
          notifications.push(notification);
        }
      }

      console.log(`Generated ${notifications.length} new content recommendation notifications`);
      return notifications;

    } catch (error) {
      console.error('Error processing new content recommendations:', error);
      return [];
    }
  }

  /**
   * Generate weekly digest of personalized recommendations
   */
  async generateWeeklyDigest(): Promise<RecommendationNotification | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      console.log('Generating weekly recommendation digest...');

      // Check if it's the right day for weekly digest
      const today = new Date();
      if (today.getDay() !== this.WEEKLY_DIGEST_DAY) {
        return null;
      }

      // Get user preferences
      const userPrefs = await this.getUserPreferences(user.id);
      if (!userPrefs) return null;

      // Get user's watchlist for preference analysis
      const watchlist = await storageService.getWatchlist();
      const genrePreferences = await this.analyzeUserGenrePreferences(watchlist);

      // Get trending content and new releases
      const [trendingMovies, trendingTVShows, newReleases] = await Promise.all([
        this.getTrendingContent('movie'),
        this.getTrendingContent('tv'),
        this.getNewReleases()
      ]);

      // Combine and filter content
      const allContent = [...trendingMovies, ...trendingTVShows, ...newReleases];
      const filteredContent = await this.filterContentByPreferences(
        allContent,
        genrePreferences,
        userPrefs.subscribed_services
      );

      // Select top items for digest
      const digestItems = filteredContent
        .sort((a, b) => b.recommendation_score - a.recommendation_score)
        .slice(0, this.MAX_DIGEST_ITEMS)
        .map(item => ({
          id: item.id,
          type: item.type,
          title: item.title,
          rating: item.vote_average,
          genres: item.genre_ids.map(id => this.getGenreName(id)).filter(Boolean)
        }));

      if (digestItems.length === 0) {
        console.log('No items for weekly digest');
        return null;
      }

      // Create digest notification
      const notification: RecommendationNotification = {
        id: `weekly_digest_${user.id}_${Date.now()}`,
        type: 'recommendation',
        title: 'Your Weekly StreamScribe Digest',
        body: `${digestItems.length} new recommendations based on your taste`,
        data: {
          recommendationType: 'weekly_digest',
          digestItems
        },
        priority: 'normal'
      };

      console.log(`Generated weekly digest with ${digestItems.length} items`);
      return notification;

    } catch (error) {
      console.error('Error generating weekly digest:', error);
      return null;
    }
  }

  /**
   * Get trending content available on user's subscribed services
   */
  async processTrendingRecommendations(): Promise<RecommendationNotification[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      console.log('Processing trending recommendations...');

      // Get user preferences
      const userPrefs = await this.getUserPreferences(user.id);
      if (!userPrefs || userPrefs.subscribed_services.length === 0) {
        return [];
      }

      // Get trending content
      const [trendingMovies, trendingTVShows] = await Promise.all([
        this.getTrendingContent('movie'),
        this.getTrendingContent('tv')
      ]);

      const allTrending = [...trendingMovies, ...trendingTVShows];

      // Filter by availability on subscribed services
      const availableContent = await this.filterByStreamingAvailability(
        allTrending,
        userPrefs.subscribed_services
      );

      // Generate notifications for trending content
      const notifications: RecommendationNotification[] = [];

      for (const content of availableContent.slice(0, 3)) { // Limit to top 3
        const notification: RecommendationNotification = {
          id: `trending_${content.type}_${content.id}_${Date.now()}`,
          type: 'recommendation',
          title: `Trending Now: ${content.title}`,
          body: `Highly rated ${content.type} (${content.vote_average}/10) now available on your services`,
          data: {
            recommendationType: 'trending',
            contentId: content.id,
            contentType: content.type,
            contentTitle: content.title,
            rating: content.vote_average,
            streamingServices: content.streaming_services
          },
          priority: 'normal'
        };

        notifications.push(notification);
      }

      console.log(`Generated ${notifications.length} trending recommendation notifications`);
      return notifications;

    } catch (error) {
      console.error('Error processing trending recommendations:', error);
      return [];
    }
  }

  /**
   * Filter notifications based on user preferences
   */
  async filterNotificationsByPreferences(
    notifications: RecommendationNotification[]
  ): Promise<RecommendationNotification[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get notification preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const notificationPrefs = prefs as NotificationPreferences | null;

      if (!notificationPrefs || !notificationPrefs.recommendations) {
        console.log('Recommendation notifications disabled by user preferences');
        return [];
      }

      // Apply quiet hours filtering
      const filteredNotifications = notifications.filter(notification => {
        if (notificationPrefs.quietHours.enabled) {
          const now = new Date();
          const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          if (this.isInQuietHours(currentTime, notificationPrefs.quietHours)) {
            // Schedule for after quiet hours
            const scheduledTime = this.calculateScheduleAfterQuietHours(notificationPrefs.quietHours);
            notification.scheduledFor = scheduledTime;
          }
        }

        return true;
      });

      // Apply frequency filtering
      if (notificationPrefs.frequency === 'weekly') {
        // Only allow weekly digest notifications
        return filteredNotifications.filter(n => 
          n.data.recommendationType === 'weekly_digest'
        );
      } else if (notificationPrefs.frequency === 'daily') {
        // Limit to one notification per day per type
        return this.limitDailyNotifications(filteredNotifications);
      }

      return filteredNotifications;

    } catch (error) {
      console.error('Error filtering notifications by preferences:', error);
      return notifications;
    }
  }

  /**
   * Get new highly-rated content from TMDB
   */
  private async getNewHighRatedContent(): Promise<ContentRecommendation[]> {
    try {
      const [movies, tvShows] = await Promise.all([
        tmdbService.getPopularMovies(),
        tmdbService.getPopularTVShows()
      ]);

      const allContent: ContentRecommendation[] = [];

      // Process movies
      movies.forEach(movie => {
        if (movie.vote_average >= this.HIGH_RATING_THRESHOLD) {
          allContent.push({
            id: movie.id,
            type: 'movie',
            title: movie.title,
            overview: movie.overview,
            poster_path: movie.poster_path,
            vote_average: movie.vote_average,
            genre_ids: movie.genre_ids,
            release_date: movie.release_date,
            popularity: movie.popularity,
            streaming_services: [],
            recommendation_score: this.calculateRecommendationScore(movie),
            recommendation_reason: ['High rating', 'Popular']
          });
        }
      });

      // Process TV shows
      tvShows.forEach(show => {
        if (show.vote_average >= this.HIGH_RATING_THRESHOLD) {
          allContent.push({
            id: show.id,
            type: 'tv',
            title: show.name,
            overview: show.overview,
            poster_path: show.poster_path,
            vote_average: show.vote_average,
            genre_ids: show.genre_ids,
            first_air_date: show.first_air_date,
            popularity: show.popularity,
            streaming_services: [],
            recommendation_score: this.calculateRecommendationScore(show),
            recommendation_reason: ['High rating', 'Popular']
          });
        }
      });

      return allContent;

    } catch (error) {
      console.error('Error getting new high-rated content:', error);
      return [];
    }
  }

  /**
   * Get trending content from TMDB
   */
  private async getTrendingContent(type: 'movie' | 'tv'): Promise<ContentRecommendation[]> {
    try {
      const content = type === 'movie' 
        ? await tmdbService.getTrendingMovies()
        : await tmdbService.getTrendingTVShows();

      return content
        .filter(item => item.popularity >= this.TRENDING_POPULARITY_THRESHOLD)
        .map(item => ({
          id: item.id,
          type,
          title: type === 'movie' ? (item as Movie).title : (item as TVShow).name,
          overview: item.overview,
          poster_path: item.poster_path,
          vote_average: item.vote_average,
          genre_ids: item.genre_ids,
          release_date: type === 'movie' ? (item as Movie).release_date : undefined,
          first_air_date: type === 'tv' ? (item as TVShow).first_air_date : undefined,
          popularity: item.popularity,
          streaming_services: [],
          recommendation_score: this.calculateRecommendationScore(item),
          recommendation_reason: ['Trending', 'Popular']
        }));

    } catch (error) {
      console.error(`Error getting trending ${type} content:`, error);
      return [];
    }
  }

  /**
   * Get new releases from TMDB
   */
  private async getNewReleases(): Promise<ContentRecommendation[]> {
    try {
      const [movies, tvShows] = await Promise.all([
        tmdbService.getNowPlayingMovies(),
        tmdbService.getAiringTodayTVShows()
      ]);

      const allContent: ContentRecommendation[] = [];

      // Process movies
      movies.forEach(movie => {
        allContent.push({
          id: movie.id,
          type: 'movie',
          title: movie.title,
          overview: movie.overview,
          poster_path: movie.poster_path,
          vote_average: movie.vote_average,
          genre_ids: movie.genre_ids,
          release_date: movie.release_date,
          popularity: movie.popularity,
          streaming_services: [],
          recommendation_score: this.calculateRecommendationScore(movie),
          recommendation_reason: ['New release']
        });
      });

      // Process TV shows
      tvShows.forEach(show => {
        allContent.push({
          id: show.id,
          type: 'tv',
          title: show.name,
          overview: show.overview,
          poster_path: show.poster_path,
          vote_average: show.vote_average,
          genre_ids: show.genre_ids,
          first_air_date: show.first_air_date,
          popularity: show.popularity,
          streaming_services: [],
          recommendation_score: this.calculateRecommendationScore(show),
          recommendation_reason: ['New release']
        });
      });

      return allContent;

    } catch (error) {
      console.error('Error getting new releases:', error);
      return [];
    }
  }

  /**
   * Analyze user's genre preferences based on watchlist
   */
  private async analyzeUserGenrePreferences(watchlist: WatchlistItem[]): Promise<Map<number, number>> {
    const genreCount = new Map<number, number>();
    const genreRating = new Map<number, number>();

    // OPTIMIZED: Batch fetch details for all watchlist items using Promise.all
    const detailsPromises = watchlist.map(async (item) => {
      try {
        const details = item.type === 'movie' 
          ? await tmdbService.getMovieDetails(item.id)
          : await tmdbService.getTVShowDetails(item.id);

        if (details && 'genre_ids' in details) {
          return {
            item,
            genres: details.genre_ids || []
          };
        }
      } catch (error) {
        console.warn(`Failed to get details for ${item.title}:`, error);
      }
      return null;
    });

    const detailsResults = await Promise.all(detailsPromises);
    
    // Process genre data
    detailsResults.forEach(result => {
      if (result) {
        result.genres.forEach(genreId => {
          genreCount.set(genreId, (genreCount.get(genreId) || 0) + 1);
          genreRating.set(genreId, (genreRating.get(genreId) || 0) + result.item.vote_average);
        });
      }
    });

    // Calculate preference scores (frequency * average rating)
    const preferences = new Map<number, number>();
    
    for (const [genreId, count] of Array.from(genreCount.entries())) {
      const avgRating = (genreRating.get(genreId) || 0) / count;
      const preferenceScore = count * avgRating;
      preferences.set(genreId, preferenceScore);
    }

    return preferences;
  }

  /**
   * Filter content based on user preferences
   */
  private async filterContentByPreferences(
    content: ContentRecommendation[],
    genrePreferences: Map<number, number>,
    subscribedServices: string[]
  ): Promise<ContentRecommendation[]> {
    const filtered: ContentRecommendation[] = [];

    for (const item of content) {
      // Calculate genre match score
      let genreMatchScore = 0;
      let hasPreferredGenre = false;

      item.genre_ids.forEach(genreId => {
        const preference = genrePreferences.get(genreId) || 0;
        if (preference > 0) {
          genreMatchScore += preference;
          hasPreferredGenre = true;
        }
      });

      // Only include if user has shown interest in at least one genre
      if (!hasPreferredGenre && genrePreferences.size > 0) {
        continue;
      }

      // Check streaming availability if user has subscriptions
      if (subscribedServices.length > 0) {
        try {
          const streamingOptions = await tmdbService.getWatchProviders(item.id, item.type);
          const availableServices = streamingOptions
            ?.filter(option => option.type === 'flatrate')
            ?.map(option => option.service.id) || [];

          const hasSubscribedService = availableServices.some(serviceId => 
            subscribedServices.includes(serviceId)
          );

          if (!hasSubscribedService) {
            continue; // Skip if not available on subscribed services
          }

          item.streaming_services = availableServices;
        } catch (error) {
          console.warn(`Failed to check streaming availability for ${item.title}:`, error);
          continue;
        }
      }

      // Update recommendation score with genre match
      item.recommendation_score += genreMatchScore * 0.3;

      // Add genre match reason
      if (hasPreferredGenre) {
        item.recommendation_reason.push('Matches your taste');
      }

      filtered.push(item);
    }

    return filtered.sort((a, b) => b.recommendation_score - a.recommendation_score);
  }

  /**
   * Filter content by streaming availability
   */
  private async filterByStreamingAvailability(
    content: ContentRecommendation[],
    subscribedServices: string[]
  ): Promise<ContentRecommendation[]> {
    const available: ContentRecommendation[] = [];

    for (const item of content) {
      try {
        const streamingOptions = await tmdbService.getWatchProviders(item.id, item.type);
        const availableServices = streamingOptions
          ?.filter(option => option.type === 'flatrate')
          ?.map(option => option.service.id) || [];

        const hasSubscribedService = availableServices.some(serviceId => 
          subscribedServices.includes(serviceId)
        );

        if (hasSubscribedService) {
          item.streaming_services = availableServices;
          available.push(item);
        }
      } catch (error) {
        console.warn(`Failed to check streaming availability for ${item.title}:`, error);
      }
    }

    return available;
  }

  /**
   * Create a content recommendation notification
   */
  private async createContentRecommendationNotification(
    userId: string,
    content: ContentRecommendation,
    genrePreferences: Map<number, number>
  ): Promise<RecommendationNotification | null> {
    try {
      // Check if we've already notified about this content recently
      const recentNotification = await this.checkRecentNotification(userId, content.id, content.type);
      if (recentNotification) {
        return null;
      }

      const genreNames = content.genre_ids
        .map(id => this.getGenreName(id))
        .filter(Boolean)
        .slice(0, 2); // Limit to 2 genres

      const notification: RecommendationNotification = {
        id: `recommendation_${content.type}_${content.id}_${Date.now()}`,
        type: 'recommendation',
        title: `New Recommendation: ${content.title}`,
        body: `${genreNames.join(', ')} • ${content.vote_average}/10 • ${content.recommendation_reason.join(', ')}`,
        data: {
          recommendationType: 'new_content',
          contentId: content.id,
          contentType: content.type,
          contentTitle: content.title,
          genreIds: content.genre_ids,
          rating: content.vote_average,
          streamingServices: content.streaming_services
        },
        priority: content.recommendation_score > 80 ? 'high' : 'normal'
      };

      // Store notification record to prevent duplicates
      await this.storeNotificationRecord(userId, content.id, content.type);

      return notification;

    } catch (error) {
      console.error('Error creating content recommendation notification:', error);
      return null;
    }
  }

  /**
   * Calculate recommendation score for content
   */
  private calculateRecommendationScore(content: Movie | TVShow): number {
    const ratingScore = (content.vote_average / 10) * 40; // 0-40 points
    const popularityScore = Math.min(content.popularity / 100, 1) * 30; // 0-30 points
    const voteCountScore = Math.min(content.vote_count / 1000, 1) * 20; // 0-20 points
    const recencyScore = this.getRecencyScore(content) * 10; // 0-10 points

    return ratingScore + popularityScore + voteCountScore + recencyScore;
  }

  /**
   * Get recency score based on release date
   */
  private getRecencyScore(content: Movie | TVShow): number {
    const releaseDate = 'release_date' in content ? content.release_date : content.first_air_date;
    if (!releaseDate) return 0.5;

    const release = new Date(releaseDate);
    const now = new Date();
    const monthsOld = (now.getTime() - release.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (monthsOld < 1) return 1.0;
    if (monthsOld < 3) return 0.8;
    if (monthsOld < 6) return 0.6;
    if (monthsOld < 12) return 0.4;
    return 0.2;
  }

  /**
   * Get user preferences from database
   */
  private async getUserPreferences(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return null;
    }
  }

  /**
   * Check if we've recently notified about this content
   */
  private async checkRecentNotification(userId: string, contentId: number, contentType: string): Promise<boolean> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('notification_history')
        .select('id')
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .eq('notification_type', 'recommendation')
        .gte('created_at', oneDayAgo)
        .limit(1);

      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking recent notification:', error);
      return false;
    }
  }

  /**
   * Store notification record to prevent duplicates
   */
  private async storeNotificationRecord(userId: string, contentId: number, contentType: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notification_history')
        .insert({
          user_id: userId,
          content_id: contentId,
          content_type: contentType,
          notification_type: 'recommendation',
          created_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error storing notification record:', error);
    }
  }

  /**
   * Get genre name by ID
   */
  private getGenreName(genreId: number): string {
    const genreMap: { [key: number]: string } = {
      28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
      99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
      27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
      10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
      10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
      10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
    };

    return genreMap[genreId] || '';
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(currentTime: string, quietHours: { start: string; end: string }): boolean {
    const current = this.timeToMinutes(currentTime);
    const start = this.timeToMinutes(quietHours.start);
    const end = this.timeToMinutes(quietHours.end);

    if (start <= end) {
      return current >= start && current <= end;
    } else {
      // Quiet hours span midnight
      return current >= start || current <= end;
    }
  }

  /**
   * Convert time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Calculate schedule time after quiet hours
   */
  private calculateScheduleAfterQuietHours(quietHours: { start: string; end: string }): string {
    const now = new Date();
    const endTime = quietHours.end;
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const scheduleDate = new Date(now);
    scheduleDate.setHours(endHours, endMinutes, 0, 0);

    // If end time is earlier in the day, it means quiet hours span midnight
    if (endHours < now.getHours()) {
      scheduleDate.setDate(scheduleDate.getDate() + 1);
    }

    return scheduleDate.toISOString();
  }

  /**
   * Limit daily notifications to prevent spam
   */
  private limitDailyNotifications(notifications: RecommendationNotification[]): RecommendationNotification[] {
    const typeCount = new Map<string, number>();
    const filtered: RecommendationNotification[] = [];

    for (const notification of notifications) {
      const type = notification.data.recommendationType;
      const count = typeCount.get(type) || 0;

      if (count < 1) { // Max 1 per type per day
        typeCount.set(type, count + 1);
        filtered.push(notification);
      }
    }

    return filtered;
  }
}

export const recommendationNotificationService = new RecommendationNotificationService();