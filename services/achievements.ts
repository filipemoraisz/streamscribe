import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import {
  Achievement,
  UserAchievement,
  AchievementProgress,
  AchievementStats,
  AchievementTier
} from '../types';

const CACHE_KEY = 'streamscribe_achievements_cache';
const USER_ACHIEVEMENTS_CACHE_KEY = 'streamscribe_user_achievements_cache';
const ACHIEVEMENT_PROGRESS_CACHE_KEY = 'streamscribe_achievement_progress_cache';
const UNLOCK_QUEUE_KEY = 'streamscribe_achievement_unlock_queue';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface CachedAchievements {
  data: Achievement[];
  timestamp: number;
}

interface CachedUserAchievements {
  userId: string;
  data: UserAchievement[];
  timestamp: number;
}

interface CachedAchievementProgress {
  userId: string;
  data: AchievementProgress[];
  timestamp: number;
}

interface AchievementUnlockQueueItem {
  userId: string;
  achievementId: string;
  progressValue: number;
  timestamp: string;
}

class AchievementsService {
  constructor() {
    // Attempt to sync on startup
    this.syncPendingUnlocks();
  }

  // ============================================
  // Core Methods - Fetching Data
  // ============================================

  /**
   * Get all available achievements with caching
   */
  async getAllAchievements(): Promise<Achievement[]> {
    try {
      // Try to get from cache first
      const cached = await this.getCachedAchievements();
      if (cached && cached.length > 0) {
        return cached;
      }

      // Fetch from Supabase
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching achievements:', error);
        // Return cached data even if expired
        return cached || [];
      }

      if (data) {
        // Cache the achievements
        await this.cacheAchievements(data);
        return data;
      }

      return [];
    } catch (error) {
      console.error('Error in getAllAchievements:', error);
      // Try to return cached data as fallback
      const cached = await this.getCachedAchievements();
      return cached || [];
    }
  }

  /**
   * Get user's unlocked achievements with caching
   */
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      // Try to get from cache first
      const cached = await this.getCachedUserAchievements(userId);
      if (cached && cached.length > 0) {
        // Trigger background sync
        this.syncUserAchievements(userId).catch(err => 
          console.error('Background sync failed:', err)
        );
        return cached;
      }

      // Fetch from Supabase
      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false });

      if (error) {
        console.error('Error fetching user achievements:', error);
        // Return cached data even if expired
        return cached || [];
      }

      if (data) {
        // Cache the user achievements
        await this.cacheUserAchievements(userId, data);
        return data;
      }

      return [];
    } catch (error) {
      console.error('Error in getUserAchievements:', error);
      // Try to return cached data as fallback
      const cached = await this.getCachedUserAchievements(userId);
      return cached || [];
    }
  }

  /**
   * Get progress toward locked achievements with caching
   */
  async getAchievementProgress(userId: string): Promise<AchievementProgress[]> {
    try {
      // Try to get from cache first
      const cached = await this.getCachedAchievementProgress(userId);
      if (cached && cached.length > 0) {
        // Trigger background sync
        this.syncAchievementProgress(userId).catch(err => 
          console.error('Background sync failed:', err)
        );
        return cached;
      }

      // Fetch from Supabase
      const { data, error } = await supabase
        .from('achievement_progress')
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching achievement progress:', error);
        // Return cached data even if expired
        return cached || [];
      }

      // Calculate progress percentage for each
      const progressWithPercentage = (data || []).map(progress => ({
        ...progress,
        progress_percentage: (progress.current_value / progress.target_value) * 100
      }));

      if (progressWithPercentage) {
        // Cache the progress
        await this.cacheAchievementProgress(userId, progressWithPercentage);
      }

      return progressWithPercentage;
    } catch (error) {
      console.error('Error in getAchievementProgress:', error);
      // Try to return cached data as fallback
      const cached = await this.getCachedAchievementProgress(userId);
      return cached || [];
    }
  }

  /**
   * Calculate achievement statistics for a user
   */
  async getAchievementStats(userId: string): Promise<AchievementStats> {
    try {
      // Get all achievements
      const allAchievements = await this.getAllAchievements();
      
      // Get user's unlocked achievements
      const userAchievements = await this.getUserAchievements(userId);
      
      // Get progress toward locked achievements
      const progress = await this.getAchievementProgress(userId);

      // Calculate total points
      const totalPoints = userAchievements.reduce((sum, ua) => {
        return sum + (ua.achievement?.points || 0);
      }, 0);

      // Calculate tier breakdown
      const tierBreakdown = {
        bronze: { unlocked: 0, total: 0 },
        silver: { unlocked: 0, total: 0 },
        gold: { unlocked: 0, total: 0 },
        platinum: { unlocked: 0, total: 0 }
      };

      // Count total by tier
      allAchievements.forEach(achievement => {
        tierBreakdown[achievement.tier].total++;
      });

      // Count unlocked by tier
      userAchievements.forEach(ua => {
        if (ua.achievement) {
          tierBreakdown[ua.achievement.tier].unlocked++;
        }
      });

      // Get recent achievements (last 5)
      const recentAchievements = userAchievements.slice(0, 5);

      // Get achievements close to unlock (>75% progress)
      const closeToUnlock = progress
        .filter(p => p.progress_percentage > 75)
        .sort((a, b) => b.progress_percentage - a.progress_percentage);

      const stats: AchievementStats = {
        total_unlocked: userAchievements.length,
        total_available: allAchievements.length,
        completion_percentage: allAchievements.length > 0 
          ? (userAchievements.length / allAchievements.length) * 100 
          : 0,
        total_points: totalPoints,
        by_tier: tierBreakdown,
        recent_achievements: recentAchievements,
        close_to_unlock: closeToUnlock
      };

      return stats;
    } catch (error) {
      console.error('Error in getAchievementStats:', error);
      // Return empty stats
      return {
        total_unlocked: 0,
        total_available: 0,
        completion_percentage: 0,
        total_points: 0,
        by_tier: {
          bronze: { unlocked: 0, total: 0 },
          silver: { unlocked: 0, total: 0 },
          gold: { unlocked: 0, total: 0 },
          platinum: { unlocked: 0, total: 0 }
        },
        recent_achievements: [],
        close_to_unlock: []
      };
    }
  }

  // ============================================
  // Caching Methods
  // ============================================

  /**
   * Cache achievements to AsyncStorage
   */
  private async cacheAchievements(achievements: Achievement[]): Promise<void> {
    try {
      const cacheData: CachedAchievements = {
        data: achievements,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching achievements:', error);
    }
  }

  /**
   * Get cached achievements from AsyncStorage
   */
  private async getCachedAchievements(): Promise<Achievement[] | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const cacheData: CachedAchievements = JSON.parse(cached);
      
      // Check if cache is still valid
      const isExpired = Date.now() - cacheData.timestamp > CACHE_EXPIRY;
      
      if (isExpired) {
        // Cache expired, but return it anyway as fallback
        // The caller will try to fetch fresh data
        return cacheData.data;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Error getting cached achievements:', error);
      return null;
    }
  }

  /**
   * Cache user achievements to AsyncStorage
   */
  private async cacheUserAchievements(userId: string, achievements: UserAchievement[]): Promise<void> {
    try {
      const cacheData: CachedUserAchievements = {
        userId,
        data: achievements,
        timestamp: Date.now()
      };
      const key = `${USER_ACHIEVEMENTS_CACHE_KEY}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching user achievements:', error);
    }
  }

  /**
   * Get cached user achievements from AsyncStorage
   */
  private async getCachedUserAchievements(userId: string): Promise<UserAchievement[] | null> {
    try {
      const key = `${USER_ACHIEVEMENTS_CACHE_KEY}_${userId}`;
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const cacheData: CachedUserAchievements = JSON.parse(cached);
      
      // Check if cache is still valid
      const isExpired = Date.now() - cacheData.timestamp > CACHE_EXPIRY;
      
      if (isExpired) {
        // Cache expired, but return it anyway as fallback
        return cacheData.data;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Error getting cached user achievements:', error);
      return null;
    }
  }

  /**
   * Cache achievement progress to AsyncStorage
   */
  private async cacheAchievementProgress(userId: string, progress: AchievementProgress[]): Promise<void> {
    try {
      const cacheData: CachedAchievementProgress = {
        userId,
        data: progress,
        timestamp: Date.now()
      };
      const key = `${ACHIEVEMENT_PROGRESS_CACHE_KEY}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching achievement progress:', error);
    }
  }

  /**
   * Get cached achievement progress from AsyncStorage
   */
  private async getCachedAchievementProgress(userId: string): Promise<AchievementProgress[] | null> {
    try {
      const key = `${ACHIEVEMENT_PROGRESS_CACHE_KEY}_${userId}`;
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const cacheData: CachedAchievementProgress = JSON.parse(cached);
      
      // Check if cache is still valid
      const isExpired = Date.now() - cacheData.timestamp > CACHE_EXPIRY;
      
      if (isExpired) {
        // Cache expired, but return it anyway as fallback
        return cacheData.data;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Error getting cached achievement progress:', error);
      return null;
    }
  }

  /**
   * Clear achievements cache
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error('Error clearing achievements cache:', error);
    }
  }

  /**
   * Clear all caches for a specific user
   */
  async clearUserCache(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${USER_ACHIEVEMENTS_CACHE_KEY}_${userId}`);
      await AsyncStorage.removeItem(`${ACHIEVEMENT_PROGRESS_CACHE_KEY}_${userId}`);
    } catch (error) {
      console.error('Error clearing user achievement cache:', error);
    }
  }

  // ============================================
  // Achievement Unlock Logic
  // ============================================

  /**
   * Check and unlock achievements based on trigger type
   * Returns newly unlocked achievements
   */
  async checkAndUnlockAchievements(
    userId: string,
    triggerType: 'episode' | 'streak' | 'completion' | 'savings' | 'efficiency'
  ): Promise<UserAchievement[]> {
    try {
      // Get all achievements
      const allAchievements = await this.getAllAchievements();
      
      // Get user's already unlocked achievements
      const userAchievements = await this.getUserAchievements(userId);
      const unlockedIds = new Set(userAchievements.map(ua => ua.achievement_id));

      // Filter achievements by trigger type
      const relevantAchievements = allAchievements.filter(achievement => {
        // Skip already unlocked
        if (unlockedIds.has(achievement.id)) return false;

        // Filter by trigger type
        switch (triggerType) {
          case 'episode':
            return achievement.unlock_criteria.type === 'episode_count';
          case 'streak':
            return achievement.unlock_criteria.type === 'streak_days';
          case 'completion':
            return achievement.unlock_criteria.type === 'show_completions';
          case 'savings':
            return achievement.unlock_criteria.type === 'total_savings';
          case 'efficiency':
            return achievement.unlock_criteria.type === 'monthly_efficiency';
          default:
            return false;
        }
      });

      // Check each relevant achievement
      const newlyUnlocked: UserAchievement[] = [];

      for (const achievement of relevantAchievements) {
        const shouldUnlock = await this.checkAchievementCriteria(userId, achievement);
        
        if (shouldUnlock) {
          // Unlock the achievement
          const unlockedAchievement = await this.unlockAchievement(userId, achievement);
          if (unlockedAchievement) {
            newlyUnlocked.push(unlockedAchievement);
          }
        } else {
          // Update progress for locked achievement
          await this.updateProgressForAchievement(userId, achievement);
        }
      }

      return newlyUnlocked;
    } catch (error) {
      console.error('Error in checkAndUnlockAchievements:', error);
      return [];
    }
  }

  /**
   * Check if achievement criteria is met
   */
  private async checkAchievementCriteria(
    userId: string,
    achievement: Achievement
  ): Promise<boolean> {
    try {
      const { type, value, comparison = 'gte' } = achievement.unlock_criteria;
      let currentValue = 0;

      // Get current value based on criteria type
      switch (type) {
        case 'episode_count':
          currentValue = await this.getTotalEpisodesWatched(userId);
          break;
        case 'streak_days':
          currentValue = await this.getCurrentStreak(userId);
          break;
        case 'show_completions':
          currentValue = await this.getTotalCompletedShows(userId);
          break;
        case 'total_savings':
          currentValue = await this.getTotalSavings(userId);
          break;
        case 'monthly_efficiency':
          currentValue = await this.getMonthlyEfficiency(userId);
          break;
        default:
          return false;
      }

      // Compare based on comparison operator
      switch (comparison) {
        case 'gte':
          return currentValue >= value;
        case 'lte':
          return currentValue <= value;
        case 'eq':
          return currentValue === value;
        default:
          return currentValue >= value;
      }
    } catch (error) {
      console.error('Error checking achievement criteria:', error);
      return false;
    }
  }

  /**
   * Unlock an achievement for a user (with offline support)
   */
  private async unlockAchievement(
    userId: string,
    achievement: Achievement
  ): Promise<UserAchievement | null> {
    try {
      // Get current value for progress_value
      const currentValue = await this.getCurrentValueForCriteria(userId, achievement.unlock_criteria.type);

      // Check if we're online
      const netInfo = await NetInfo.fetch();
      
      if (!netInfo.isConnected) {
        // Queue for later sync
        await this.addToUnlockQueue({
          userId,
          achievementId: achievement.id,
          progressValue: currentValue,
          timestamp: new Date().toISOString()
        });

        // Create optimistic local achievement
        const optimisticAchievement: UserAchievement = {
          id: `temp_${Date.now()}`, // Temporary ID
          user_id: userId,
          achievement_id: achievement.id,
          achievement: achievement,
          unlocked_at: new Date().toISOString(),
          progress_value: currentValue,
          notified: false
        };

        // Update local cache
        await this.addToLocalUserAchievements(userId, optimisticAchievement);

        return optimisticAchievement;
      }

      // Online - insert to database
      const { data, error } = await supabase
        .from('user_achievements')
        .insert({
          user_id: userId,
          achievement_id: achievement.id,
          progress_value: currentValue,
          notified: false
        })
        .select(`
          *,
          achievement:achievements(*)
        `)
        .single();

      if (error) {
        // If error, queue for later
        console.error('Error unlocking achievement:', error);
        await this.addToUnlockQueue({
          userId,
          achievementId: achievement.id,
          progressValue: currentValue,
          timestamp: new Date().toISOString()
        });
        return null;
      }

      // Remove from progress table if exists
      await supabase
        .from('achievement_progress')
        .delete()
        .eq('user_id', userId)
        .eq('achievement_id', achievement.id);

      // Update local cache
      await this.addToLocalUserAchievements(userId, data);

      return data;
    } catch (error) {
      console.error('Error in unlockAchievement:', error);
      return null;
    }
  }

  /**
   * Update achievement progress for a specific achievement
   */
  async updateAchievementProgress(
    userId: string,
    achievementId: string,
    currentValue: number
  ): Promise<void> {
    try {
      // Get the achievement to know target value
      const allAchievements = await this.getAllAchievements();
      const achievement = allAchievements.find(a => a.id === achievementId);
      
      if (!achievement) {
        console.error('Achievement not found:', achievementId);
        return;
      }

      const targetValue = achievement.unlock_criteria.value;

      // Upsert progress
      const { error } = await supabase
        .from('achievement_progress')
        .upsert({
          user_id: userId,
          achievement_id: achievementId,
          current_value: currentValue,
          target_value: targetValue,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'user_id,achievement_id'
        });

      if (error) {
        console.error('Error updating achievement progress:', error);
      }
    } catch (error) {
      console.error('Error in updateAchievementProgress:', error);
    }
  }

  /**
   * Update progress for a specific achievement (internal helper)
   */
  private async updateProgressForAchievement(
    userId: string,
    achievement: Achievement
  ): Promise<void> {
    try {
      const currentValue = await this.getCurrentValueForCriteria(
        userId,
        achievement.unlock_criteria.type
      );

      await this.updateAchievementProgress(userId, achievement.id, currentValue);
    } catch (error) {
      console.error('Error updating progress for achievement:', error);
    }
  }

  // ============================================
  // Helper Methods for Data Retrieval
  // ============================================

  /**
   * Get current value for a specific criteria type
   */
  private async getCurrentValueForCriteria(
    userId: string,
    criteriaType: string
  ): Promise<number> {
    switch (criteriaType) {
      case 'episode_count':
        return await this.getTotalEpisodesWatched(userId);
      case 'streak_days':
        return await this.getCurrentStreak(userId);
      case 'show_completions':
        return await this.getTotalCompletedShows(userId);
      case 'total_savings':
        return await this.getTotalSavings(userId);
      case 'monthly_efficiency':
        return await this.getMonthlyEfficiency(userId);
      default:
        return 0;
    }
  }

  /**
   * Get total episodes watched by user
   */
  private async getTotalEpisodesWatched(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('episode_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('watched', true);

      if (error) {
        console.error('Error getting total episodes watched:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getTotalEpisodesWatched:', error);
      return 0;
    }
  }

  /**
   * Get current streak from user_activity_tracking
   */
  private async getCurrentStreak(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('user_activity_tracking')
        .select('current_streak')
        .eq('user_id', userId)
        .single();

      if (error) {
        // User might not have activity tracking record yet
        return 0;
      }

      return data?.current_streak || 0;
    } catch (error) {
      console.error('Error in getCurrentStreak:', error);
      return 0;
    }
  }

  /**
   * Get total completed shows
   */
  private async getTotalCompletedShows(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('show_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed');

      if (error) {
        console.error('Error getting total completed shows:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getTotalCompletedShows:', error);
      return 0;
    }
  }

  /**
   * Get total savings - placeholder for future implementation
   */
  private async getTotalSavings(userId: string): Promise<number> {
    // Savings tracking not yet implemented in database
    return 0;
  }

  /**
   * Get monthly efficiency - placeholder for future implementation
   */
  private async getMonthlyEfficiency(userId: string): Promise<number> {
    // Efficiency tracking not yet implemented in database
    return 0;
  }

  // ============================================
  // Offline Queue Management
  // ============================================

  /**
   * Add achievement unlock to offline queue
   */
  private async addToUnlockQueue(item: AchievementUnlockQueueItem): Promise<void> {
    try {
      const queueJson = await AsyncStorage.getItem(UNLOCK_QUEUE_KEY);
      const queue: AchievementUnlockQueueItem[] = queueJson ? JSON.parse(queueJson) : [];
      
      // Check if already in queue
      const exists = queue.some(
        q => q.userId === item.userId && q.achievementId === item.achievementId
      );
      
      if (!exists) {
        queue.push(item);
        await AsyncStorage.setItem(UNLOCK_QUEUE_KEY, JSON.stringify(queue));
      }

      // Try to sync immediately
      this.syncPendingUnlocks();
    } catch (error) {
      console.error('Error adding to unlock queue:', error);
    }
  }

  /**
   * Sync pending achievement unlocks when back online
   */
  async syncPendingUnlocks(): Promise<void> {
    const state = await NetInfo.fetch();
    if (!state.isConnected) return;

    try {
      const queueJson = await AsyncStorage.getItem(UNLOCK_QUEUE_KEY);
      if (!queueJson) return;

      const queue: AchievementUnlockQueueItem[] = JSON.parse(queueJson);
      if (queue.length === 0) return;

      const remainingQueue: AchievementUnlockQueueItem[] = [];

      for (const item of queue) {
        try {
          // Check if achievement already exists (conflict resolution)
          const { data: existing, error: checkError } = await supabase
            .from('user_achievements')
            .select('id')
            .eq('user_id', item.userId)
            .eq('achievement_id', item.achievementId)
            .single();

          if (existing) {
            // Achievement already unlocked on server - skip
            console.log('Achievement already unlocked on server, skipping:', item.achievementId);
            continue;
          }

          // Insert the achievement
          const { error } = await supabase
            .from('user_achievements')
            .insert({
              user_id: item.userId,
              achievement_id: item.achievementId,
              progress_value: item.progressValue,
              unlocked_at: item.timestamp,
              notified: false
            });

          if (error) {
            console.error('Failed to sync achievement unlock:', item, error);
            remainingQueue.push(item);
          } else {
            // Remove from progress table if exists
            await supabase
              .from('achievement_progress')
              .delete()
              .eq('user_id', item.userId)
              .eq('achievement_id', item.achievementId);
          }
        } catch (err) {
          console.error('Failed to sync achievement unlock:', item, err);
          remainingQueue.push(item);
        }
      }

      // Update queue with remaining items
      await AsyncStorage.setItem(UNLOCK_QUEUE_KEY, JSON.stringify(remainingQueue));

      // If queue is empty, sync user achievements to ensure consistency
      if (remainingQueue.length === 0) {
        // Clear cache to force fresh fetch
        const processedUsers = new Set(queue.map(q => q.userId));
        for (const userId of processedUsers) {
          await this.clearUserCache(userId);
        }
      }
    } catch (error) {
      console.error('Error syncing pending achievement unlocks:', error);
    }
  }

  /**
   * Add achievement to local cache (optimistic update)
   */
  private async addToLocalUserAchievements(userId: string, achievement: UserAchievement): Promise<void> {
    try {
      const key = `${USER_ACHIEVEMENTS_CACHE_KEY}_${userId}`;
      const cached = await AsyncStorage.getItem(key);
      
      let achievements: UserAchievement[] = [];
      if (cached) {
        const cacheData: CachedUserAchievements = JSON.parse(cached);
        achievements = cacheData.data;
      }

      // Check if already exists
      const exists = achievements.some(a => a.achievement_id === achievement.achievement_id);
      if (!exists) {
        achievements.unshift(achievement); // Add to beginning
        
        const cacheData: CachedUserAchievements = {
          userId,
          data: achievements,
          timestamp: Date.now()
        };
        await AsyncStorage.setItem(key, JSON.stringify(cacheData));
      }
    } catch (error) {
      console.error('Error adding to local user achievements:', error);
    }
  }

  /**
   * Sync user achievements from server
   */
  private async syncUserAchievements(userId: string): Promise<void> {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) return;

      // Fetch from Supabase
      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false });

      if (!error && data) {
        // Update cache
        await this.cacheUserAchievements(userId, data);
      }
    } catch (error) {
      console.error('Error syncing user achievements:', error);
    }
  }

  /**
   * Sync achievement progress from server
   */
  private async syncAchievementProgress(userId: string): Promise<void> {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) return;

      // Fetch from Supabase
      const { data, error } = await supabase
        .from('achievement_progress')
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq('user_id', userId);

      if (!error && data) {
        // Calculate progress percentage for each
        const progressWithPercentage = data.map(progress => ({
          ...progress,
          progress_percentage: (progress.current_value / progress.target_value) * 100
        }));

        // Update cache
        await this.cacheAchievementProgress(userId, progressWithPercentage);
      }
    } catch (error) {
      console.error('Error syncing achievement progress:', error);
    }
  }

  /**
   * Get pending unlock queue count
   */
  async getPendingUnlockCount(): Promise<number> {
    try {
      const queueJson = await AsyncStorage.getItem(UNLOCK_QUEUE_KEY);
      if (!queueJson) return 0;

      const queue: AchievementUnlockQueueItem[] = JSON.parse(queueJson);
      return queue.length;
    } catch (error) {
      console.error('Error getting pending unlock count:', error);
      return 0;
    }
  }
}

export const achievementsService = new AchievementsService();
