import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { notificationManager } from './notifications';
import type { 
  Achievement, 
  AchievementNotificationPreferences,
  AchievementNotificationQueue,
  LocalNotification 
} from '../types';

const PREFERENCES_CACHE_KEY = '@achievement_notification_preferences';
const NOTIFICATION_QUEUE_KEY = '@achievement_notification_queue';

/**
 * Service for managing achievement notification display and delivery
 */
class AchievementNotificationsService {
  private notificationQueue: AchievementNotificationQueue[] = [];
  private isProcessingQueue = false;
  private preferencesCache: AchievementNotificationPreferences | null = null;

  /**
   * Display full-screen unlock modal for achievement
   * This is typically used for high-tier achievements (Gold/Platinum)
   */
  async showUnlockScreen(achievement: Achievement): Promise<void> {
    try {
      console.log('Showing unlock screen for achievement:', achievement.name);
      
      // Get user preferences
      const preferences = await this.getNotificationPreferences();
      
      // Check if full-screen notifications are enabled
      if (!preferences.in_app_full_screen) {
        console.log('Full-screen notifications disabled, skipping');
        return;
      }

      // Queue the notification for display
      await this.queueNotification(achievement, 'full_screen');
      
      // Process the queue
      await this.processNotificationQueue();
    } catch (error) {
      console.error('Error showing unlock screen:', error);
      throw error;
    }
  }

  /**
   * Display compact banner notification for achievement
   * This is typically used for lower-tier achievements (Bronze/Silver)
   */
  async showUnlockBanner(achievement: Achievement): Promise<void> {
    try {
      console.log('Showing unlock banner for achievement:', achievement.name);
      
      // Get user preferences
      const preferences = await this.getNotificationPreferences();
      
      // Check if banner notifications are enabled
      if (!preferences.in_app_banner) {
        console.log('Banner notifications disabled, skipping');
        return;
      }

      // Queue the notification for display
      await this.queueNotification(achievement, 'banner');
      
      // Process the queue
      await this.processNotificationQueue();
    } catch (error) {
      console.error('Error showing unlock banner:', error);
      throw error;
    }
  }

  /**
   * Add achievement notification to queue with priority sorting
   */
  async queueNotification(
    achievement: Achievement, 
    displayMode: 'full_screen' | 'banner' = 'banner'
  ): Promise<void> {
    try {
      const queueItem: AchievementNotificationQueue = {
        id: `achievement_${achievement.id}_${Date.now()}`,
        achievement,
        timestamp: new Date().toISOString(),
        displayed: false,
        displayMode,
      };

      // Add to in-memory queue
      this.notificationQueue.push(queueItem);

      // Sort queue by priority (tier-based)
      this.sortQueueByPriority();

      // Persist queue to storage
      await this.saveQueueToStorage();

      console.log(`Achievement notification queued: ${achievement.name} (${displayMode})`);
    } catch (error) {
      console.error('Error queueing notification:', error);
      throw error;
    }
  }

  /**
   * Process queued notifications sequentially
   * Displays one notification at a time, waiting for user interaction
   */
  async processNotificationQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessingQueue) {
      console.log('Queue already being processed, skipping');
      return;
    }

    try {
      this.isProcessingQueue = true;

      // Load queue from storage if empty
      if (this.notificationQueue.length === 0) {
        await this.loadQueueFromStorage();
      }

      // Filter out already displayed notifications
      const pendingNotifications = this.notificationQueue.filter(n => !n.displayed);

      if (pendingNotifications.length === 0) {
        console.log('No pending notifications to process');
        return;
      }

      console.log(`Processing ${pendingNotifications.length} pending achievement notifications`);

      // Process notifications one at a time
      for (const notification of pendingNotifications) {
        try {
          // Mark as displayed
          notification.displayed = true;

          // Display based on mode
          if (notification.displayMode === 'full_screen') {
            // Full-screen modal will be handled by the UI component
            // We just emit an event or update state that the UI can listen to
            console.log(`Full-screen notification ready: ${notification.achievement.name}`);
          } else {
            // Banner notification will be handled by the UI component
            console.log(`Banner notification ready: ${notification.achievement.name}`);
          }

          // Update queue in storage
          await this.saveQueueToStorage();

          // Small delay between notifications to prevent overwhelming the user
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('Error processing notification:', error);
        }
      }

      // Clean up displayed notifications after processing
      await this.cleanupDisplayedNotifications();
    } catch (error) {
      console.error('Error processing notification queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Sort notification queue by priority (tier-based)
   * Platinum > Gold > Silver > Bronze
   */
  private sortQueueByPriority(): void {
    const tierPriority: Record<string, number> = {
      platinum: 4,
      gold: 3,
      silver: 2,
      bronze: 1,
    };

    this.notificationQueue.sort((a, b) => {
      const priorityA = tierPriority[a.achievement.tier] || 0;
      const priorityB = tierPriority[b.achievement.tier] || 0;
      
      // Higher tier = higher priority
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      
      // If same tier, sort by timestamp (older first)
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }

  /**
   * Save notification queue to AsyncStorage
   */
  private async saveQueueToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        NOTIFICATION_QUEUE_KEY,
        JSON.stringify(this.notificationQueue)
      );
    } catch (error) {
      console.error('Error saving notification queue to storage:', error);
    }
  }

  /**
   * Load notification queue from AsyncStorage
   */
  private async loadQueueFromStorage(): Promise<void> {
    try {
      const queueJson = await AsyncStorage.getItem(NOTIFICATION_QUEUE_KEY);
      if (queueJson) {
        this.notificationQueue = JSON.parse(queueJson);
        console.log(`Loaded ${this.notificationQueue.length} notifications from storage`);
      }
    } catch (error) {
      console.error('Error loading notification queue from storage:', error);
      this.notificationQueue = [];
    }
  }

  /**
   * Clean up displayed notifications from queue
   */
  private async cleanupDisplayedNotifications(): Promise<void> {
    try {
      // Remove notifications displayed more than 1 hour ago
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      this.notificationQueue = this.notificationQueue.filter(notification => {
        if (!notification.displayed) {
          return true; // Keep undisplayed notifications
        }
        
        const notificationTime = new Date(notification.timestamp).getTime();
        return notificationTime > oneHourAgo; // Keep recent displayed notifications
      });

      await this.saveQueueToStorage();
      console.log('Cleaned up old displayed notifications');
    } catch (error) {
      console.error('Error cleaning up displayed notifications:', error);
    }
  }

  /**
   * Get notification preferences for current user
   */
  async getNotificationPreferences(): Promise<AchievementNotificationPreferences> {
    try {
      // Check cache first
      if (this.preferencesCache) {
        return this.preferencesCache;
      }

      // Try to load from local storage
      const cachedPrefs = await AsyncStorage.getItem(PREFERENCES_CACHE_KEY);
      if (cachedPrefs) {
        this.preferencesCache = JSON.parse(cachedPrefs);
        return this.preferencesCache!;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return this.getDefaultPreferences();
      }

      // Fetch from database
      const { data, error } = await supabase
        .from('achievement_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No preferences found, create default
          const defaultPrefs = this.getDefaultPreferences(user.id);
          await this.createDefaultPreferences(user.id);
          return defaultPrefs;
        }
        throw error;
      }

      // Cache the preferences
      this.preferencesCache = data;
      await AsyncStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(data));

      return data;
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Update notification preferences for current user
   */
  async updateNotificationPreferences(
    preferences: Partial<AchievementNotificationPreferences>
  ): Promise<void> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No user logged in');
      }

      // Update in database
      const { error } = await supabase
        .from('achievement_notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }

      // Update cache
      const updatedPrefs = {
        ...this.preferencesCache,
        ...preferences,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      } as AchievementNotificationPreferences;

      this.preferencesCache = updatedPrefs;
      await AsyncStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(updatedPrefs));

      console.log('Achievement notification preferences updated');
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  /**
   * Create default preferences for a user
   */
  private async createDefaultPreferences(userId: string): Promise<void> {
    try {
      const defaultPrefs = this.getDefaultPreferences(userId);

      const { error } = await supabase
        .from('achievement_notification_preferences')
        .insert(defaultPrefs);

      if (error) {
        throw error;
      }

      console.log('Created default achievement notification preferences');
    } catch (error) {
      console.error('Error creating default preferences:', error);
    }
  }

  /**
   * Get default notification preferences
   */
  private getDefaultPreferences(userId?: string): AchievementNotificationPreferences {
    return {
      user_id: userId || '',
      in_app_full_screen: true,
      in_app_banner: true,
      push_notifications: true,
      sound_enabled: true,
      haptic_enabled: true,
      progress_reminders: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Clear preferences cache
   */
  async clearPreferencesCache(): Promise<void> {
    this.preferencesCache = null;
    await AsyncStorage.removeItem(PREFERENCES_CACHE_KEY);
  }

  /**
   * Get pending notifications count
   */
  getPendingNotificationsCount(): number {
    return this.notificationQueue.filter(n => !n.displayed).length;
  }

  /**
   * Clear all notifications from queue
   */
  async clearNotificationQueue(): Promise<void> {
    this.notificationQueue = [];
    await AsyncStorage.removeItem(NOTIFICATION_QUEUE_KEY);
    console.log('Notification queue cleared');
  }

  /**
   * Send push notification for achievement unlock
   * Respects user preferences and quiet hours
   */
  async sendAchievementPushNotification(
    userId: string,
    achievement: Achievement
  ): Promise<void> {
    try {
      console.log('Sending achievement push notification:', achievement.name);

      // Get user preferences
      const preferences = await this.getNotificationPreferences();

      // Check if push notifications are enabled
      if (!preferences.push_notifications) {
        console.log('Push notifications disabled for achievements');
        return;
      }

      // Check quiet hours
      const isQuietHours = await this.isInQuietHours();
      if (isQuietHours) {
        console.log('Currently in quiet hours, scheduling for later');
        await this.scheduleAchievementReminder(userId, achievement, 100);
        return;
      }

      // Create notification payload with deep linking
      const notification: LocalNotification = {
        id: `achievement_push_${achievement.id}_${Date.now()}`,
        title: `🏆 Achievement Unlocked!`,
        body: `${achievement.name} - ${achievement.description}`,
        data: {
          type: 'achievement_unlock',
          achievementId: achievement.id,
          achievementKey: achievement.achievement_key,
          tier: achievement.tier,
          points: achievement.points,
        },
        trigger: {
          seconds: 1,
        },
      };

      // Schedule the push notification
      await notificationManager.scheduleLocalNotification(notification);

      console.log('Achievement push notification sent');
    } catch (error) {
      console.error('Error sending achievement push notification:', error);
      throw error;
    }
  }

  /**
   * Schedule achievement reminder for progress milestones
   * Sends notification when user is close to unlocking an achievement
   */
  async scheduleAchievementReminder(
    userId: string,
    achievement: Achievement,
    progressPercentage: number
  ): Promise<void> {
    try {
      console.log(`Scheduling achievement reminder for ${achievement.name} at ${progressPercentage}% progress`);

      // Get user preferences
      const preferences = await this.getNotificationPreferences();

      // Check if progress reminders are enabled
      if (!preferences.progress_reminders) {
        console.log('Progress reminders disabled');
        return;
      }

      // Only send reminders for high progress (>90%)
      if (progressPercentage < 90) {
        console.log('Progress too low for reminder');
        return;
      }

      // Calculate when to send the reminder (after quiet hours if applicable)
      const scheduledDate = await this.calculateScheduledTime();

      // Create reminder notification
      const notification: LocalNotification = {
        id: `achievement_reminder_${achievement.id}_${Date.now()}`,
        title: `🎯 Almost There!`,
        body: `You're ${progressPercentage}% of the way to unlocking "${achievement.name}"`,
        data: {
          type: 'achievement_unlock',
          achievementId: achievement.id,
          achievementKey: achievement.achievement_key,
          progress: progressPercentage,
        },
        trigger: scheduledDate ? { date: scheduledDate } : { seconds: 1 },
      };

      // Schedule the reminder
      await notificationManager.scheduleLocalNotification(notification);

      console.log('Achievement reminder scheduled');
    } catch (error) {
      console.error('Error scheduling achievement reminder:', error);
      throw error;
    }
  }

  /**
   * Check if current time is within quiet hours
   */
  private async isInQuietHours(): Promise<boolean> {
    try {
      // Get notification preferences from the main notification service
      const notificationPrefs = await notificationManager.getPreferences();

      if (!notificationPrefs || !notificationPrefs.quietHours?.enabled) {
        return false;
      }

      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      const { start, end } = notificationPrefs.quietHours;
      const [startHour, startMin] = start.split(':').map(Number);
      const [endHour, endMin] = end.split(':').map(Number);

      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      // Handle quiet hours that span midnight
      if (startTime > endTime) {
        return currentTime >= startTime || currentTime < endTime;
      }

      return currentTime >= startTime && currentTime < endTime;
    } catch (error) {
      console.error('Error checking quiet hours:', error);
      return false;
    }
  }

  /**
   * Calculate scheduled time for notification (after quiet hours)
   */
  private async calculateScheduledTime(): Promise<Date | null> {
    try {
      const isQuietHours = await this.isInQuietHours();

      if (!isQuietHours) {
        return null; // Send immediately
      }

      // Get notification preferences
      const notificationPrefs = await notificationManager.getPreferences();

      if (!notificationPrefs || !notificationPrefs.quietHours?.enabled) {
        return null;
      }

      const { end } = notificationPrefs.quietHours;
      const [endHour, endMin] = end.split(':').map(Number);

      const scheduledDate = new Date();
      scheduledDate.setHours(endHour, endMin, 0, 0);

      // If the end time is earlier than now, schedule for tomorrow
      if (scheduledDate <= new Date()) {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
      }

      return scheduledDate;
    } catch (error) {
      console.error('Error calculating scheduled time:', error);
      return null;
    }
  }

  /**
   * Handle deep linking from achievement notifications
   * Navigates to achievements screen when notification is tapped
   */
  handleAchievementDeepLink(achievementId: string): void {
    try {
      console.log('Handling achievement deep link:', achievementId);
      
      // This will be implemented by the navigation system
      // For now, just log the action
      // The actual navigation will be handled by the notificationDeepLinking service
      
      // Example payload that would be used:
      // {
      //   type: 'achievement',
      //   achievementId: achievementId,
      //   screen: 'achievements'
      // }
    } catch (error) {
      console.error('Error handling achievement deep link:', error);
    }
  }
}

// Export singleton instance
export const achievementNotificationsService = new AchievementNotificationsService();
