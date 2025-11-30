import { supabase } from './supabase';
import { achievementNotificationsService } from './achievementNotifications';
import { Achievement, UserAchievement } from '../types';

/**
 * Achievement Checker Service
 * 
 * This service contains the logic for checking achievement unlock conditions
 * by querying relevant data sources (episode_progress, user_activity_tracking,
 * show_progress, user_engagement_analytics).
 * 
 * Also handles unlocking achievements and triggering notifications.
 */
class AchievementChecker {
  // ============================================
  // Achievement Processing and Unlocking
  // ============================================

  /**
   * Process achievement IDs and unlock them if not already unlocked
   * Triggers notifications for newly unlocked achievements
   */
  private async processAndUnlockAchievements(
    userId: string,
    achievementIds: string[]
  ): Promise<UserAchievement[]> {
    if (achievementIds.length === 0) {
      return [];
    }

    try {
      // Get full achievement details
      const { data: achievements, error: achievementsError } = await supabase
        .from('achievements')
        .select('*')
        .in('id', achievementIds);

      if (achievementsError || !achievements) {
        console.error('Error fetching achievement details:', achievementsError);
        return [];
      }

      // Check which achievements are already unlocked
      const { data: existingUnlocks, error: existingError } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', userId)
        .in('achievement_id', achievementIds);

      if (existingError) {
        console.error('Error checking existing unlocks:', existingError);
        return [];
      }

      const alreadyUnlockedIds = new Set(existingUnlocks?.map(u => u.achievement_id) || []);
      const newlyUnlocked: UserAchievement[] = [];

      // Unlock new achievements
      for (const achievement of achievements) {
        if (alreadyUnlockedIds.has(achievement.id)) {
          continue; // Already unlocked
        }

        // Insert into user_achievements
        const { data: userAchievement, error: unlockError } = await supabase
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_id: achievement.id,
            unlocked_at: new Date().toISOString(),
            notified: false,
            notification_shown: false,
            push_sent: false,
          })
          .select()
          .single();

        if (unlockError) {
          console.error('Error unlocking achievement:', unlockError);
          continue;
        }

        if (userAchievement) {
          // Add achievement details to the user achievement
          const fullUserAchievement: UserAchievement = {
            ...userAchievement,
            achievement: achievement as Achievement,
          };
          newlyUnlocked.push(fullUserAchievement);
        }
      }

      // Queue notifications for newly unlocked achievements
      if (newlyUnlocked.length > 0) {
        await this.queueAchievementNotifications(newlyUnlocked);
      }

      return newlyUnlocked;
    } catch (error) {
      console.error('Error in processAndUnlockAchievements:', error);
      return [];
    }
  }

  /**
   * Queue notifications for unlocked achievements
   * Determines display mode based on tier and queues appropriately
   */
  private async queueAchievementNotifications(
    userAchievements: UserAchievement[]
  ): Promise<void> {
    try {
      for (const userAchievement of userAchievements) {
        if (!userAchievement.achievement) {
          continue;
        }

        const achievement = userAchievement.achievement;
        
        // Determine display mode based on tier
        // Gold and Platinum get full-screen, Bronze and Silver get banner
        const displayMode = 
          achievement.tier === 'gold' || achievement.tier === 'platinum' 
            ? 'full_screen' 
            : 'banner';

        // Queue the notification
        await achievementNotificationsService.queueNotification(
          achievement,
          displayMode
        );

        console.log(
          `[AchievementChecker] Queued ${displayMode} notification for achievement: ${achievement.name}`
        );
      }

      // Process the notification queue
      await achievementNotificationsService.processNotificationQueue();
    } catch (error) {
      console.error('Error queueing achievement notifications:', error);
    }
  }

  // ============================================
  // Achievement Type Checkers
  // ============================================

  /**
   * Check episode-based achievements and unlock them
   * Returns array of newly unlocked user achievements
   */
  async checkEpisodeAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      const totalEpisodes = await this.getTotalEpisodesWatched(userId);
      
      // Get all episode achievements from database
      const { data: achievements, error } = await supabase
        .from('achievements')
        .select('id, unlock_criteria')
        .eq('category', 'viewing')
        .contains('unlock_criteria', { type: 'episode_count' });

      if (error || !achievements) {
        console.error('Error fetching episode achievements:', error);
        return [];
      }

      // Check which achievements should be unlocked
      const unlockedIds: string[] = [];
      for (const achievement of achievements) {
        const targetCount = achievement.unlock_criteria.value;
        if (totalEpisodes >= targetCount) {
          unlockedIds.push(achievement.id);
        }
      }

      // Process and unlock achievements with notifications
      return await this.processAndUnlockAchievements(userId, unlockedIds);
    } catch (error) {
      console.error('Error in checkEpisodeAchievements:', error);
      return [];
    }
  }

  /**
   * Check streak-based achievements and unlock them
   * Returns array of newly unlocked user achievements
   */
  async checkStreakAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      const currentStreak = await this.getCurrentStreak(userId);
      
      // Get all streak achievements from database
      const { data: achievements, error } = await supabase
        .from('achievements')
        .select('id, unlock_criteria')
        .eq('category', 'streaks')
        .contains('unlock_criteria', { type: 'streak_days' });

      if (error || !achievements) {
        console.error('Error fetching streak achievements:', error);
        return [];
      }

      // Check which achievements should be unlocked
      const unlockedIds: string[] = [];
      for (const achievement of achievements) {
        const targetDays = achievement.unlock_criteria.value;
        if (currentStreak >= targetDays) {
          unlockedIds.push(achievement.id);
        }
      }

      // Process and unlock achievements with notifications
      return await this.processAndUnlockAchievements(userId, unlockedIds);
    } catch (error) {
      console.error('Error in checkStreakAchievements:', error);
      return [];
    }
  }

  /**
   * Check completion-based achievements and unlock them
   * Returns array of newly unlocked user achievements
   */
  async checkCompletionAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      const totalCompleted = await this.getTotalCompletedShows(userId);
      
      // Get all completion achievements from database
      const { data: achievements, error } = await supabase
        .from('achievements')
        .select('id, unlock_criteria')
        .eq('category', 'completions')
        .contains('unlock_criteria', { type: 'show_completions' });

      if (error || !achievements) {
        console.error('Error fetching completion achievements:', error);
        return [];
      }

      // Check which achievements should be unlocked
      const unlockedIds: string[] = [];
      for (const achievement of achievements) {
        const targetCount = achievement.unlock_criteria.value;
        if (totalCompleted >= targetCount) {
          unlockedIds.push(achievement.id);
        }
      }

      // Process and unlock achievements with notifications
      return await this.processAndUnlockAchievements(userId, unlockedIds);
    } catch (error) {
      console.error('Error in checkCompletionAchievements:', error);
      return [];
    }
  }

  /**
   * Check savings-based achievements and unlock them
   * Returns array of newly unlocked user achievements
   */
  async checkSavingsAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      const totalSavings = await this.getTotalSavings(userId);
      
      // Get all savings achievements from database
      const { data: achievements, error } = await supabase
        .from('achievements')
        .select('id, unlock_criteria')
        .eq('category', 'savings')
        .contains('unlock_criteria', { type: 'total_savings' });

      if (error || !achievements) {
        console.error('Error fetching savings achievements:', error);
        return [];
      }

      // Check which achievements should be unlocked
      const unlockedIds: string[] = [];
      for (const achievement of achievements) {
        const targetSavings = achievement.unlock_criteria.value;
        if (totalSavings >= targetSavings) {
          unlockedIds.push(achievement.id);
        }
      }

      // Process and unlock achievements with notifications
      return await this.processAndUnlockAchievements(userId, unlockedIds);
    } catch (error) {
      console.error('Error in checkSavingsAchievements:', error);
      return [];
    }
  }

  /**
   * Check efficiency-based achievements and unlock them
   * Returns array of newly unlocked user achievements
   */
  async checkEfficiencyAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      const monthlyEfficiency = await this.getMonthlyEfficiency(userId);
      
      // Get all efficiency achievements from database
      const { data: achievements, error } = await supabase
        .from('achievements')
        .select('id, unlock_criteria')
        .eq('category', 'efficiency')
        .contains('unlock_criteria', { type: 'monthly_efficiency' });

      if (error || !achievements) {
        console.error('Error fetching efficiency achievements:', error);
        return [];
      }

      // Check which achievements should be unlocked
      // Note: For efficiency, lower is better, so we use <= comparison
      const unlockedIds: string[] = [];
      for (const achievement of achievements) {
        const targetEfficiency = achievement.unlock_criteria.value;
        const comparison = achievement.unlock_criteria.comparison || 'lte';
        
        if (comparison === 'lte' && monthlyEfficiency <= targetEfficiency && monthlyEfficiency > 0) {
          unlockedIds.push(achievement.id);
        } else if (comparison === 'gte' && monthlyEfficiency >= targetEfficiency) {
          unlockedIds.push(achievement.id);
        }
      }

      // Process and unlock achievements with notifications
      return await this.processAndUnlockAchievements(userId, unlockedIds);
    } catch (error) {
      console.error('Error in checkEfficiencyAchievements:', error);
      return [];
    }
  }

  // ============================================
  // Helper Methods for Data Aggregation
  // ============================================

  /**
   * Get total episodes watched by user from episode_progress table
   */
  async getTotalEpisodesWatched(userId: string): Promise<number> {
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
   * Get current streak from user_activity_tracking table
   */
  async getCurrentStreak(userId: string): Promise<number> {
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
   * Get total completed shows from show_progress table
   */
  async getTotalCompletedShows(userId: string): Promise<number> {
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
   * TODO: Implement when savings tracking is added to the database
   */
  async getTotalSavings(userId: string): Promise<number> {
    // Savings tracking not yet implemented in database
    return 0;
  }

  /**
   * Get monthly efficiency - placeholder for future implementation
   * TODO: Implement when efficiency tracking is added to the database
   */
  async getMonthlyEfficiency(userId: string): Promise<number> {
    // Efficiency tracking not yet implemented in database
    return 0;
  }
}

export const achievementChecker = new AchievementChecker();
