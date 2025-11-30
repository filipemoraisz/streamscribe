import { backgroundTaskManager, TaskResult } from './backgroundTaskManager';
import { achievementChecker } from './achievementChecker';
import { supabase } from './supabase';

/**
 * Service to manage background tasks for achievement checking
 * Handles periodic checks for savings and efficiency achievements
 */
class AchievementBackgroundTasks {
  private savingsTaskId?: string;
  private efficiencyTaskId?: string;
  private isInitialized = false;

  /**
   * Initialize achievement background tasks
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[AchievementBackgroundTasks] Already initialized');
      return;
    }

    try {
      console.log('[AchievementBackgroundTasks] Initializing achievement background tasks');

      // Register savings achievement check task
      this.savingsTaskId = await backgroundTaskManager.registerTask({
        name: 'achievement_savings_check',
        priority: 'normal',
        handler: async () => await this.checkSavingsAchievements(),
        interval: 60 * 60 * 1000, // Check every hour
        maxRetries: 3,
        timeout: 30000, // 30 seconds
        enabled: true,
      });

      // Register efficiency achievement check task
      this.efficiencyTaskId = await backgroundTaskManager.registerTask({
        name: 'achievement_efficiency_check',
        priority: 'normal',
        handler: async () => await this.checkEfficiencyAchievements(),
        interval: 24 * 60 * 60 * 1000, // Check daily
        maxRetries: 3,
        timeout: 30000, // 30 seconds
        enabled: true,
      });

      this.isInitialized = true;
      console.log('[AchievementBackgroundTasks] Achievement background tasks initialized');
    } catch (error) {
      console.error('[AchievementBackgroundTasks] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Check savings achievements for the current user
   */
  private async checkSavingsAchievements(): Promise<TaskResult> {
    const startTime = Date.now();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[AchievementBackgroundTasks] No user logged in, skipping savings check');
        return {
          success: true,
          data: { message: 'No user logged in' },
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      console.log('[AchievementBackgroundTasks] Checking savings achievements');
      await achievementChecker.checkSavingsAchievements(user.id);
      return {
        success: true,
        data: { message: 'Savings achievements checked' },
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[AchievementBackgroundTasks] Error checking savings achievements:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check efficiency achievements for the current user
   */
  private async checkEfficiencyAchievements(): Promise<TaskResult> {
    const startTime = Date.now();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[AchievementBackgroundTasks] No user logged in, skipping efficiency check');
        return {
          success: true,
          data: { message: 'No user logged in' },
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      console.log('[AchievementBackgroundTasks] Checking efficiency achievements');
      await achievementChecker.checkEfficiencyAchievements(user.id);
      return {
        success: true,
        data: { message: 'Efficiency achievements checked' },
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[AchievementBackgroundTasks] Error checking efficiency achievements:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Manually trigger savings achievement check
   */
  async triggerSavingsCheck(): Promise<void> {
    if (!this.savingsTaskId) {
      console.warn('[AchievementBackgroundTasks] Savings task not registered');
      return;
    }

    try {
      console.log('[AchievementBackgroundTasks] Manually triggering savings check');
      await backgroundTaskManager.forceExecuteTask(this.savingsTaskId);
    } catch (error) {
      console.error('[AchievementBackgroundTasks] Error triggering savings check:', error);
      throw error;
    }
  }

  /**
   * Manually trigger efficiency achievement check
   */
  async triggerEfficiencyCheck(): Promise<void> {
    if (!this.efficiencyTaskId) {
      console.warn('[AchievementBackgroundTasks] Efficiency task not registered');
      return;
    }

    try {
      console.log('[AchievementBackgroundTasks] Manually triggering efficiency check');
      await backgroundTaskManager.forceExecuteTask(this.efficiencyTaskId);
    } catch (error) {
      console.error('[AchievementBackgroundTasks] Error triggering efficiency check:', error);
      throw error;
    }
  }

  /**
   * Hook to be called when user_impact_stats is updated
   * This should be called from wherever the impact stats are updated
   */
  async onImpactStatsUpdated(userId: string): Promise<void> {
    try {
      console.log('[AchievementBackgroundTasks] Impact stats updated, checking achievements');
      
      // Check both savings and efficiency achievements when stats are updated
      await Promise.all([
        achievementChecker.checkSavingsAchievements(userId),
        achievementChecker.checkEfficiencyAchievements(userId),
      ]);
    } catch (error) {
      console.error('[AchievementBackgroundTasks] Error checking achievements after stats update:', error);
      // Don't throw - we don't want to fail the stats update if achievement check fails
    }
  }

  /**
   * Enable or disable savings achievement checks
   */
  async setSavingsCheckEnabled(enabled: boolean): Promise<void> {
    if (!this.savingsTaskId) {
      console.warn('[AchievementBackgroundTasks] Savings task not registered');
      return;
    }

    await backgroundTaskManager.setTaskEnabled(this.savingsTaskId, enabled);
  }

  /**
   * Enable or disable efficiency achievement checks
   */
  async setEfficiencyCheckEnabled(enabled: boolean): Promise<void> {
    if (!this.efficiencyTaskId) {
      console.warn('[AchievementBackgroundTasks] Efficiency task not registered');
      return;
    }

    await backgroundTaskManager.setTaskEnabled(this.efficiencyTaskId, enabled);
  }

  /**
   * Get statistics for achievement background tasks
   */
  getTaskStatistics(): {
    savings?: ReturnType<typeof backgroundTaskManager.getTaskStatistics>;
    efficiency?: ReturnType<typeof backgroundTaskManager.getTaskStatistics>;
  } {
    const stats: any = {};

    if (this.savingsTaskId) {
      stats.savings = backgroundTaskManager.getTaskStatistics(this.savingsTaskId);
    }

    if (this.efficiencyTaskId) {
      stats.efficiency = backgroundTaskManager.getTaskStatistics(this.efficiencyTaskId);
    }

    return stats;
  }

  /**
   * Cleanup and destroy achievement background tasks
   */
  async destroy(): Promise<void> {
    console.log('[AchievementBackgroundTasks] Destroying achievement background tasks');

    if (this.savingsTaskId) {
      await backgroundTaskManager.unregisterTask(this.savingsTaskId);
      this.savingsTaskId = undefined;
    }

    if (this.efficiencyTaskId) {
      await backgroundTaskManager.unregisterTask(this.efficiencyTaskId);
      this.efficiencyTaskId = undefined;
    }

    this.isInitialized = false;
    console.log('[AchievementBackgroundTasks] Achievement background tasks destroyed');
  }
}

// Export singleton instance
export const achievementBackgroundTasks = new AchievementBackgroundTasks();
