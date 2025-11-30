import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { achievementsService } from './achievements';
import { UserStats } from '../types';

const USER_STATS_CACHE_KEY = 'streamscribe_user_stats_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface CachedUserStats {
  userId: string;
  data: UserStats;
  timestamp: number;
}

class UserActivityService {
  /**
   * Get comprehensive user stats combining activity tracking and achievements
   */
  async getUserStats(userId: string): Promise<UserStats> {
    try {
      // Try to get from cache first
      const cached = await this.getCachedUserStats(userId);
      if (cached) {
        // Trigger background refresh
        this.refreshUserStats(userId).catch(err => 
          console.error('Background refresh failed:', err)
        );
        return cached;
      }

      // Fetch fresh data
      return await this.fetchUserStats(userId);
    } catch (error) {
      console.error('Error in getUserStats:', error);
      // Try to return cached data even if expired
      const cached = await this.getCachedUserStats(userId, true);
      if (cached) return cached;
      
      // Return empty stats as fallback
      return this.getEmptyStats();
    }
  }

  /**
   * Fetch user stats from database and services
   */
  private async fetchUserStats(userId: string): Promise<UserStats> {
    try {
      // Fetch activity tracking data from database
      const { data: activityData, error: activityError } = await supabase
        .from('user_activity_tracking')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (activityError && activityError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is okay for new users
        console.error('Error fetching activity data:', activityError);
      }

      // Get shows completed count
      const showsCompleted = await this.getShowsCompleted(userId);

      // Get total episodes watched
      const totalEpisodes = await this.getTotalEpisodes(userId);

      // Get achievement stats
      const achievementStats = await achievementsService.getAchievementStats(userId);

      // Combine all data
      const stats: UserStats = {
        // Streak data from activity tracking
        currentStreak: activityData?.current_streak || 0,
        longestStreak: activityData?.longest_streak || 0,
        lastStreakDate: activityData?.last_streak_date || null,
        
        // Viewing data
        totalEpisodes: totalEpisodes,
        totalHoursWatched: activityData?.total_hours_watched || 0,
        showsCompleted: showsCompleted,
        
        // Achievement data
        achievementPoints: achievementStats.total_points,
        achievementsUnlocked: achievementStats.total_unlocked,
        achievementsTotal: achievementStats.total_available,
        
        // Impact data
        totalSavings: activityData?.total_savings || 0,
        optimizedHours: activityData?.optimized_hours || 0,
        monthlyEfficiency: activityData?.monthly_efficiency || 0,
      };

      // Cache the stats
      await this.cacheUserStats(userId, stats);

      return stats;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Get shows completed count
   */
  private async getShowsCompleted(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('show_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed');

      if (error) {
        console.error('Error getting shows completed:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getShowsCompleted:', error);
      return 0;
    }
  }

  /**
   * Get total episodes watched
   */
  private async getTotalEpisodes(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('episode_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('watched', true);

      if (error) {
        console.error('Error getting total episodes:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getTotalEpisodes:', error);
      return 0;
    }
  }

  /**
   * Update streak when episode is watched
   * Calls the Supabase function to calculate and update streak
   */
  async updateStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number }> {
    try {
      console.log(`[UserActivity] Calling update_user_streak RPC for user: ${userId}`);
      
      const { data, error } = await supabase
        .rpc('update_user_streak', { p_user_id: userId });

      if (error) {
        console.error('[UserActivity] Error updating streak:', error);
        console.error('[UserActivity] Error details:', JSON.stringify(error));
        return { currentStreak: 0, longestStreak: 0 };
      }

      console.log('[UserActivity] RPC response:', data);

      // Clear cache to force refresh
      await this.clearUserStatsCache(userId);

      const result = {
        currentStreak: data[0]?.current_streak || 0,
        longestStreak: data[0]?.longest_streak || 0,
      };
      
      console.log('[UserActivity] Streak result:', result);
      
      return result;
    } catch (error) {
      console.error('[UserActivity] Error in updateStreak:', error);
      return { currentStreak: 0, longestStreak: 0 };
    }
  }

  /**
   * Get aggregated stats directly from database
   * This bypasses cache and fetches fresh data
   */
  async getAggregatedStats(userId: string): Promise<{
    totalEpisodes: number;
    showsCompleted: number;
    totalHoursWatched: number;
    currentStreak: number;
    longestStreak: number;
  }> {
    try {
      // Fetch all data in parallel for better performance
      const [episodeCount, showCount, activityData] = await Promise.all([
        this.getTotalEpisodes(userId),
        this.getShowsCompleted(userId),
        supabase
          .from('user_activity_tracking')
          .select('total_hours_watched, current_streak, longest_streak')
          .eq('user_id', userId)
          .single()
      ]);

      return {
        totalEpisodes: episodeCount,
        showsCompleted: showCount,
        totalHoursWatched: activityData.data?.total_hours_watched || 0,
        currentStreak: activityData.data?.current_streak || 0,
        longestStreak: activityData.data?.longest_streak || 0,
      };
    } catch (error) {
      console.error('Error getting aggregated stats:', error);
      return {
        totalEpisodes: 0,
        showsCompleted: 0,
        totalHoursWatched: 0,
        currentStreak: 0,
        longestStreak: 0,
      };
    }
  }

  /**
   * Update activity tracking metrics
   * Used to update hours watched and other metrics
   */
  async updateActivityMetrics(
    userId: string,
    updates: {
      totalHoursWatched?: number;
      totalSavings?: number;
      optimizedHours?: number;
      monthlyEfficiency?: number;
    }
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_activity_tracking')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating activity metrics:', error);
        return false;
      }

      // Clear cache to reflect new data
      await this.clearUserStatsCache(userId);
      return true;
    } catch (error) {
      console.error('Error in updateActivityMetrics:', error);
      return false;
    }
  }

  /**
   * Increment episode count in activity tracking
   * Called when an episode is marked as watched
   */
  async incrementEpisodeCount(userId: string, runtime: number = 0): Promise<void> {
    try {
      // Get current values
      const { data: current } = await supabase
        .from('user_activity_tracking')
        .select('total_episodes_watched, total_hours_watched')
        .eq('user_id', userId)
        .single();

      if (!current) {
        console.warn('No activity tracking record found for user');
        return;
      }

      // Calculate new values
      const newEpisodeCount = (current.total_episodes_watched || 0) + 1;
      const newHoursWatched = (current.total_hours_watched || 0) + (runtime / 60);

      // Update
      const { error } = await supabase
        .from('user_activity_tracking')
        .update({
          total_episodes_watched: newEpisodeCount,
          total_hours_watched: newHoursWatched,
          last_episode_watched: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error incrementing episode count:', error);
      }
    } catch (error) {
      console.error('Error in incrementEpisodeCount:', error);
    }
  }

  /**
   * Get streak status for a user
   * Returns current streak and whether it's active (watched today)
   */
  async getStreakStatus(userId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
    lastStreakDate: string | null;
    isActiveToday: boolean;
  }> {
    try {
      const { data, error } = await supabase
        .from('user_activity_tracking')
        .select('current_streak, longest_streak, last_streak_date')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return {
          currentStreak: 0,
          longestStreak: 0,
          lastStreakDate: null,
          isActiveToday: false,
        };
      }

      const today = new Date().toISOString().split('T')[0];
      const isActiveToday = data.last_streak_date === today;

      return {
        currentStreak: data.current_streak || 0,
        longestStreak: data.longest_streak || 0,
        lastStreakDate: data.last_streak_date,
        isActiveToday,
      };
    } catch (error) {
      console.error('Error getting streak status:', error);
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastStreakDate: null,
        isActiveToday: false,
      };
    }
  }

  /**
   * Initialize activity tracking for new user
   */
  async initializeUserActivity(userId: string): Promise<void> {
    try {
      // Check if user already has activity tracking
      const { data: existing } = await supabase
        .from('user_activity_tracking')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (existing) {
        console.log('User activity tracking already exists');
        return;
      }

      // Create new activity tracking record
      const { error } = await supabase
        .from('user_activity_tracking')
        .insert({
          user_id: userId,
          current_streak: 0,
          longest_streak: 0,
          total_app_opens: 1,
          total_episodes_watched: 0,
          total_watchlist_updates: 0,
          total_hours_watched: 0,
          average_session_length: 0,
          engagement_score: 0,
          total_savings: 0,
          monthly_efficiency: 0,
          optimized_hours: 0,
          weekly_watch_pattern: [0, 0, 0, 0, 0, 0, 0],
          last_app_open: new Date().toISOString(),
        });

      if (error) {
        console.error('Error initializing user activity:', error);
        throw error;
      }

      console.log('User activity tracking initialized successfully');
    } catch (error) {
      console.error('Error in initializeUserActivity:', error);
      throw error;
    }
  }

  /**
   * Track app open event
   */
  async trackAppOpen(userId: string): Promise<void> {
    try {
      // Initialize if doesn't exist
      await this.initializeUserActivity(userId).catch(() => {
        // Ignore error if already exists
      });

      // Get current count first
      const { data: current } = await supabase
        .from('user_activity_tracking')
        .select('total_app_opens')
        .eq('user_id', userId)
        .single();

      // Update last app open and increment counter
      const { error } = await supabase
        .from('user_activity_tracking')
        .update({
          last_app_open: new Date().toISOString(),
          total_app_opens: (current?.total_app_opens || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error tracking app open:', error);
      }
    } catch (error) {
      console.error('Error in trackAppOpen:', error);
    }
  }

  /**
   * Track episode watched event
   */
  async trackEpisodeWatched(userId: string, runtime: number = 0): Promise<void> {
    try {
      console.log(`[UserActivity] trackEpisodeWatched called for user: ${userId}, runtime: ${runtime}`);
      
      // Update streak
      console.log('[UserActivity] Calling updateStreak...');
      const streakResult = await this.updateStreak(userId);
      console.log(`[UserActivity] Streak updated - Current: ${streakResult.currentStreak}, Longest: ${streakResult.longestStreak}`);

      // Update episode count and hours using database function
      console.log('[UserActivity] Calling track_episode_watched RPC...');
      const { data: trackingData, error: trackingError } = await supabase
        .rpc('track_episode_watched', { 
          p_user_id: userId,
          p_runtime_minutes: Math.round(runtime)
        });

      if (trackingError) {
        console.error('[UserActivity] Error tracking episode watched:', trackingError);
        console.error('[UserActivity] Error details:', JSON.stringify(trackingError));
      } else {
        console.log('[UserActivity] RPC response:', trackingData);
        const episodes = trackingData?.[0]?.total_episodes || 0;
        const hours = trackingData?.[0]?.total_hours || 0;
        console.log(`[UserActivity] ✅ Activity tracking updated - Episodes: ${episodes}, Hours: ${hours}`);
      }

      // Clear cache to reflect new data
      await this.clearUserStatsCache(userId);
      console.log('[UserActivity] Cache cleared');
    } catch (error) {
      console.error('[UserActivity] Error in trackEpisodeWatched:', error);
    }
  }

  /**
   * Track watchlist update event
   */
  async trackWatchlistUpdate(userId: string): Promise<void> {
    try {
      // Get current count first
      const { data: current } = await supabase
        .from('user_activity_tracking')
        .select('total_watchlist_updates')
        .eq('user_id', userId)
        .single();

      const { error } = await supabase
        .from('user_activity_tracking')
        .update({
          last_watchlist_update: new Date().toISOString(),
          total_watchlist_updates: (current?.total_watchlist_updates || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error tracking watchlist update:', error);
      }
    } catch (error) {
      console.error('Error in trackWatchlistUpdate:', error);
    }
  }

  /**
   * Cache user stats locally
   */
  private async cacheUserStats(userId: string, stats: UserStats): Promise<void> {
    try {
      const cacheData: CachedUserStats = {
        userId,
        data: stats,
        timestamp: Date.now(),
      };
      const key = `${USER_STATS_CACHE_KEY}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching user stats:', error);
    }
  }

  /**
   * Get cached user stats
   */
  private async getCachedUserStats(userId: string, ignoreExpiry: boolean = false): Promise<UserStats | null> {
    try {
      const key = `${USER_STATS_CACHE_KEY}_${userId}`;
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const cacheData: CachedUserStats = JSON.parse(cached);
      
      // Check if cache is still valid
      const isExpired = Date.now() - cacheData.timestamp > CACHE_EXPIRY;
      
      if (isExpired && !ignoreExpiry) {
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Error getting cached user stats:', error);
      return null;
    }
  }

  /**
   * Clear user stats cache
   */
  async clearUserStatsCache(userId: string): Promise<void> {
    try {
      const key = `${USER_STATS_CACHE_KEY}_${userId}`;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing user stats cache:', error);
    }
  }

  /**
   * Refresh user stats in background
   */
  private async refreshUserStats(userId: string): Promise<void> {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) return;

      const stats = await this.fetchUserStats(userId);
      await this.cacheUserStats(userId, stats);
    } catch (error) {
      console.error('Error refreshing user stats:', error);
    }
  }

  /**
   * Get empty stats object
   */
  private getEmptyStats(): UserStats {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastStreakDate: null,
      totalEpisodes: 0,
      totalHoursWatched: 0,
      showsCompleted: 0,
      achievementPoints: 0,
      achievementsUnlocked: 0,
      achievementsTotal: 0,
      totalSavings: 0,
      optimizedHours: 0,
      monthlyEfficiency: 0,
    };
  }
}

export const userActivityService = new UserActivityService();
