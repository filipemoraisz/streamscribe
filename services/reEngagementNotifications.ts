import { supabase } from './supabase';
import { tmdbService } from './tmdb';
import { storageService } from './storage';
import { progressService } from './progress';
import type { 
  NotificationPayload, 
  NotificationPreferences, 
  WatchlistItem,
  ShowProgress 
} from '../types';

export interface ReEngagementNotification extends NotificationPayload {
  type: 'recommendation';
  data: {
    recommendationType: 're_engagement';
    engagementType: 'next_episode' | 'watchlist_reminder' | 'new_content' | 'weekly_summary';
    inactiveDays: number;
    nextEpisodes?: Array<{
      showId: number;
      showTitle: string;
      seasonNumber: number;
      episodeNumber: number;
      episodeTitle?: string;
      posterPath?: string;
    }>;
    watchlistCount?: number;
    newContentCount?: number;
    weeklyStats?: {
      episodesWatched: number;
      hoursWatched: number;
      showsCompleted: number;
    };
  };
}

export interface UserActivity {
  userId: string;
  lastAppOpen: string;
  lastEpisodeWatched: string;
  lastWatchlistUpdate: string;
  totalEpisodesWatched: number;
  totalHoursWatched: number;
  averageSessionLength: number;
  preferredWatchTime?: string; // HH:MM format
  weeklyWatchPattern: number[]; // 0-6 for days of week
}

class ReEngagementNotificationService {
  private readonly INACTIVE_THRESHOLD_DAYS = 7;
  private readonly LONG_INACTIVE_THRESHOLD_DAYS = 30;
  private readonly MAX_NEXT_EPISODES = 3;
  private readonly ENGAGEMENT_SCORE_THRESHOLD = 0.3;

  /**
   * Process re-engagement notifications for inactive users
   */
  async processReEngagementNotifications(): Promise<ReEngagementNotification[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      console.log('Processing re-engagement notifications...');

      // Get user activity data
      const userActivity = await this.getUserActivity(user.id);
      if (!userActivity) {
        console.log('No user activity data found');
        return [];
      }

      // Calculate inactivity period
      const inactiveDays = this.calculateInactiveDays(userActivity);
      
      if (inactiveDays < this.INACTIVE_THRESHOLD_DAYS) {
        console.log(`User is active (${inactiveDays} days), no re-engagement needed`);
        return [];
      }

      console.log(`User inactive for ${inactiveDays} days, generating re-engagement notifications`);

      // Generate appropriate re-engagement notifications
      const notifications: ReEngagementNotification[] = [];

      // Check if we've already sent a re-engagement notification recently
      const recentNotification = await this.checkRecentReEngagementNotification(user.id);
      if (recentNotification) {
        console.log('Recent re-engagement notification already sent');
        return [];
      }

      // Determine the best re-engagement strategy
      const engagementStrategy = await this.determineEngagementStrategy(user.id, userActivity, inactiveDays);

      switch (engagementStrategy.type) {
        case 'next_episode':
          const nextEpisodeNotification = await this.createNextEpisodeNotification(
            user.id, 
            engagementStrategy.data, 
            inactiveDays
          );
          if (nextEpisodeNotification) notifications.push(nextEpisodeNotification);
          break;

        case 'watchlist_reminder':
          const watchlistNotification = await this.createWatchlistReminderNotification(
            user.id, 
            engagementStrategy.data, 
            inactiveDays
          );
          if (watchlistNotification) notifications.push(watchlistNotification);
          break;

        case 'new_content':
          const newContentNotification = await this.createNewContentNotification(
            user.id, 
            engagementStrategy.data, 
            inactiveDays
          );
          if (newContentNotification) notifications.push(newContentNotification);
          break;

        case 'weekly_summary':
          const summaryNotification = await this.createWeeklySummaryNotification(
            user.id, 
            engagementStrategy.data, 
            inactiveDays
          );
          if (summaryNotification) notifications.push(summaryNotification);
          break;
      }

      // Store re-engagement notification record
      if (notifications.length > 0) {
        await this.storeReEngagementRecord(user.id, inactiveDays, engagementStrategy.type);
      }

      console.log(`Generated ${notifications.length} re-engagement notifications`);
      return notifications;

    } catch (error) {
      console.error('Error processing re-engagement notifications:', error);
      return [];
    }
  }

  /**
   * Track user activity for engagement analysis
   */
  async trackUserActivity(userId: string, activityType: 'app_open' | 'episode_watched' | 'watchlist_update'): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      // Get existing activity record
      const { data: existingActivity } = await supabase
        .from('user_activity_tracking')
        .select('*')
        .eq('user_id', userId)
        .single();

      const updateData: any = {
        user_id: userId,
        updated_at: now
      };

      switch (activityType) {
        case 'app_open':
          updateData.last_app_open = now;
          updateData.total_app_opens = (existingActivity?.total_app_opens || 0) + 1;
          break;
        
        case 'episode_watched':
          updateData.last_episode_watched = now;
          updateData.total_episodes_watched = (existingActivity?.total_episodes_watched || 0) + 1;
          break;
        
        case 'watchlist_update':
          updateData.last_watchlist_update = now;
          updateData.total_watchlist_updates = (existingActivity?.total_watchlist_updates || 0) + 1;
          break;
      }

      // Update or insert activity record
      const { error } = await supabase
        .from('user_activity_tracking')
        .upsert(updateData, { onConflict: 'user_id' });

      if (error) throw error;

    } catch (error) {
      console.error('Error tracking user activity:', error);
    }
  }

  /**
   * Get user activity data
   */
  private async getUserActivity(userId: string): Promise<UserActivity | null> {
    try {
      const { data, error } = await supabase
        .from('user_activity_tracking')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) return null;

      return {
        userId,
        lastAppOpen: data.last_app_open,
        lastEpisodeWatched: data.last_episode_watched,
        lastWatchlistUpdate: data.last_watchlist_update,
        totalEpisodesWatched: data.total_episodes_watched || 0,
        totalHoursWatched: data.total_hours_watched || 0,
        averageSessionLength: data.average_session_length || 0,
        preferredWatchTime: data.preferred_watch_time,
        weeklyWatchPattern: data.weekly_watch_pattern || [0, 0, 0, 0, 0, 0, 0]
      };

    } catch (error) {
      console.error('Error getting user activity:', error);
      return null;
    }
  }

  /**
   * Calculate days since last activity
   */
  private calculateInactiveDays(activity: UserActivity): number {
    const lastActivity = new Date(Math.max(
      new Date(activity.lastAppOpen || 0).getTime(),
      new Date(activity.lastEpisodeWatched || 0).getTime(),
      new Date(activity.lastWatchlistUpdate || 0).getTime()
    ));

    const now = new Date();
    const diffTime = now.getTime() - lastActivity.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Determine the best re-engagement strategy
   */
  private async determineEngagementStrategy(
    userId: string, 
    activity: UserActivity, 
    inactiveDays: number
  ): Promise<{ type: string; data: any }> {
    try {
      // Get user's current progress and watchlist
      const [watchlist, progressData] = await Promise.all([
        storageService.getWatchlist(),
        this.getUserProgressSummary(userId)
      ]);

      // Strategy 1: Next episode recommendations (highest priority)
      const nextEpisodes = await this.getNextEpisodesToWatch(userId, progressData);
      if (nextEpisodes.length > 0) {
        return {
          type: 'next_episode',
          data: { nextEpisodes: nextEpisodes.slice(0, this.MAX_NEXT_EPISODES) }
        };
      }

      // Strategy 2: Watchlist reminder
      const unwatchedItems = watchlist.filter(item => !item.watched);
      if (unwatchedItems.length > 0) {
        return {
          type: 'watchlist_reminder',
          data: { 
            watchlistCount: unwatchedItems.length,
            topItems: unwatchedItems.slice(0, 3)
          }
        };
      }

      // Strategy 3: New content recommendations
      if (inactiveDays >= this.LONG_INACTIVE_THRESHOLD_DAYS) {
        const newContentCount = await this.getNewContentCount();
        return {
          type: 'new_content',
          data: { newContentCount }
        };
      }

      // Strategy 4: Weekly summary (fallback)
      const weeklyStats = await this.getWeeklyStats(userId);
      return {
        type: 'weekly_summary',
        data: { weeklyStats }
      };

    } catch (error) {
      console.error('Error determining engagement strategy:', error);
      return {
        type: 'weekly_summary',
        data: { weeklyStats: { episodesWatched: 0, hoursWatched: 0, showsCompleted: 0 } }
      };
    }
  }

  /**
   * Get next episodes to watch based on user progress
   */
  private async getNextEpisodesToWatch(userId: string, progressData: ShowProgress[]): Promise<any[]> {
    const nextEpisodes = [];

    for (const progress of progressData.slice(0, this.MAX_NEXT_EPISODES)) {
      try {
        // Get next episode details
        const nextEpisode = await tmdbService.getNextEpisode(
          progress.show_id,
          progress.current_season,
          progress.current_episode
        );

        if (nextEpisode) {
          // Get show details for title and poster
          const showDetails = await tmdbService.getTVShowDetails(progress.show_id);
          
          // Get episode details if available
          let episodeTitle;
          try {
            const episodeDetails = await tmdbService.getEpisodeDetails(
              progress.show_id,
              nextEpisode.season,
              nextEpisode.episode
            );
            episodeTitle = episodeDetails.name;
          } catch (error) {
            // Episode details not available, use generic title
            episodeTitle = `Episode ${nextEpisode.episode}`;
          }

          nextEpisodes.push({
            showId: progress.show_id,
            showTitle: showDetails.name,
            seasonNumber: nextEpisode.season,
            episodeNumber: nextEpisode.episode,
            episodeTitle,
            posterPath: showDetails.poster_path
          });
        }
      } catch (error) {
        console.warn(`Failed to get next episode for show ${progress.show_id}:`, error);
      }
    }

    return nextEpisodes;
  }

  /**
   * Get user's progress summary
   */
  private async getUserProgressSummary(userId: string): Promise<ShowProgress[]> {
    try {
      // Get shows that are currently being watched (not completed)
      const { data, error } = await supabase
        .from('show_progress')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['watching', 'up_to_date'])
        .order('last_watched_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting user progress summary:', error);
      return [];
    }
  }

  /**
   * Get count of new content available
   */
  private async getNewContentCount(): Promise<number> {
    try {
      // This is a simplified implementation
      // In a real app, you'd track what content was available when the user was last active
      const [trendingMovies, trendingTVShows] = await Promise.all([
        tmdbService.getTrendingMovies(),
        tmdbService.getTrendingTVShows()
      ]);

      return trendingMovies.length + trendingTVShows.length;
    } catch (error) {
      console.error('Error getting new content count:', error);
      return 0;
    }
  }

  /**
   * Get weekly stats for user
   */
  private async getWeeklyStats(userId: string): Promise<any> {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('episode_progress')
        .select('*')
        .eq('user_id', userId)
        .gte('watched_date', oneWeekAgo)
        .eq('watched', true);

      if (error) throw error;

      const episodesWatched = data?.length || 0;
      const hoursWatched = episodesWatched * 0.75; // Assume 45 minutes per episode
      
      // Count completed shows (simplified)
      const showsCompleted = 0; // Would need more complex logic

      return {
        episodesWatched,
        hoursWatched,
        showsCompleted
      };
    } catch (error) {
      console.error('Error getting weekly stats:', error);
      return {
        episodesWatched: 0,
        hoursWatched: 0,
        showsCompleted: 0
      };
    }
  }

  /**
   * Create next episode notification
   */
  private async createNextEpisodeNotification(
    userId: string,
    data: any,
    inactiveDays: number
  ): Promise<ReEngagementNotification | null> {
    try {
      const nextEpisodes = data.nextEpisodes;
      if (!nextEpisodes || nextEpisodes.length === 0) return null;

      const firstEpisode = nextEpisodes[0];
      const title = nextEpisodes.length === 1 
        ? `📺 Ready to continue ${firstEpisode.showTitle}?`
        : `📺 ${nextEpisodes.length} episodes waiting for you!`;

      const body = nextEpisodes.length === 1
        ? `S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber}: ${firstEpisode.episodeTitle}`
        : `Continue ${firstEpisode.showTitle} and ${nextEpisodes.length - 1} other show${nextEpisodes.length > 2 ? 's' : ''}`;

      return {
        id: `re_engagement_next_episode_${userId}_${Date.now()}`,
        type: 'recommendation',
        title,
        body,
        data: {
          recommendationType: 're_engagement',
          engagementType: 'next_episode',
          inactiveDays,
          nextEpisodes
        },
        priority: 'normal'
      };

    } catch (error) {
      console.error('Error creating next episode notification:', error);
      return null;
    }
  }

  /**
   * Create watchlist reminder notification
   */
  private async createWatchlistReminderNotification(
    userId: string,
    data: any,
    inactiveDays: number
  ): Promise<ReEngagementNotification | null> {
    try {
      const { watchlistCount, topItems } = data;

      const title = `🎬 Your watchlist is waiting!`;
      const body = watchlistCount === 1 
        ? `You have 1 item ready to watch`
        : `You have ${watchlistCount} items ready to watch`;

      return {
        id: `re_engagement_watchlist_${userId}_${Date.now()}`,
        type: 'recommendation',
        title,
        body,
        data: {
          recommendationType: 're_engagement',
          engagementType: 'watchlist_reminder',
          inactiveDays,
          watchlistCount
        },
        priority: 'normal'
      };

    } catch (error) {
      console.error('Error creating watchlist reminder notification:', error);
      return null;
    }
  }

  /**
   * Create new content notification
   */
  private async createNewContentNotification(
    userId: string,
    data: any,
    inactiveDays: number
  ): Promise<ReEngagementNotification | null> {
    try {
      const { newContentCount } = data;

      const title = `🆕 Lots of new content since your last visit!`;
      const body = `${newContentCount} new trending titles to discover`;

      return {
        id: `re_engagement_new_content_${userId}_${Date.now()}`,
        type: 'recommendation',
        title,
        body,
        data: {
          recommendationType: 're_engagement',
          engagementType: 'new_content',
          inactiveDays,
          newContentCount
        },
        priority: 'low'
      };

    } catch (error) {
      console.error('Error creating new content notification:', error);
      return null;
    }
  }

  /**
   * Create weekly summary notification
   */
  private async createWeeklySummaryNotification(
    userId: string,
    data: any,
    inactiveDays: number
  ): Promise<ReEngagementNotification | null> {
    try {
      const { weeklyStats } = data;

      const title = `📊 Your StreamScribe summary`;
      const body = weeklyStats.episodesWatched > 0 
        ? `${weeklyStats.episodesWatched} episodes watched this week`
        : `Ready to start your next binge session?`;

      return {
        id: `re_engagement_summary_${userId}_${Date.now()}`,
        type: 'recommendation',
        title,
        body,
        data: {
          recommendationType: 're_engagement',
          engagementType: 'weekly_summary',
          inactiveDays,
          weeklyStats
        },
        priority: 'low'
      };

    } catch (error) {
      console.error('Error creating weekly summary notification:', error);
      return null;
    }
  }

  /**
   * Check if we've sent a re-engagement notification recently
   */
  private async checkRecentReEngagementNotification(userId: string): Promise<boolean> {
    try {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('re_engagement_notifications')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', threeDaysAgo)
        .limit(1);

      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking recent re-engagement notification:', error);
      return false;
    }
  }

  /**
   * Store re-engagement notification record
   */
  private async storeReEngagementRecord(
    userId: string, 
    inactiveDays: number, 
    engagementType: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('re_engagement_notifications')
        .insert({
          user_id: userId,
          inactive_days: inactiveDays,
          engagement_type: engagementType,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error storing re-engagement record:', error);
    }
  }

  /**
   * Calculate optimal notification timing based on user patterns
   */
  async calculateOptimalNotificationTime(userId: string): Promise<Date | null> {
    try {
      const activity = await this.getUserActivity(userId);
      if (!activity) return null;

      // Use preferred watch time if available
      if (activity.preferredWatchTime) {
        const [hours, minutes] = activity.preferredWatchTime.split(':').map(Number);
        const optimalTime = new Date();
        optimalTime.setHours(hours, minutes, 0, 0);
        
        // If the time has passed today, schedule for tomorrow
        if (optimalTime.getTime() < Date.now()) {
          optimalTime.setDate(optimalTime.getDate() + 1);
        }
        
        return optimalTime;
      }

      // Fallback to evening time (7 PM)
      const defaultTime = new Date();
      defaultTime.setHours(19, 0, 0, 0);
      
      if (defaultTime.getTime() < Date.now()) {
        defaultTime.setDate(defaultTime.getDate() + 1);
      }
      
      return defaultTime;

    } catch (error) {
      console.error('Error calculating optimal notification time:', error);
      return null;
    }
  }
}

export const reEngagementNotificationService = new ReEngagementNotificationService();