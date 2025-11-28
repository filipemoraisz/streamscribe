import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { notificationSyncService } from './notificationSync';
import { streamingAvailabilityNotifications } from './streamingAvailabilityNotifications';
import { notificationGrouping } from './notificationGrouping';
import { recommendationNotificationService } from './recommendationNotifications';
import { showStatusNotificationService } from './showStatusNotifications';
import { reEngagementNotificationService } from './reEngagementNotifications';
import { notificationDeepLinkingService, NotificationPayload as DeepLinkPayload } from './notificationDeepLinking';
import type { 
  NotificationPreferences, 
  LocalNotification 
} from '../types';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationManager {
  // Setup & Permissions
  requestPermissions(): Promise<boolean>;
  registerForPushNotifications(): Promise<string | null>;
  
  // Notification Handling
  scheduleLocalNotification(notification: LocalNotification): Promise<string>;
  handleNotificationReceived(notification: Notifications.Notification): void;
  handleNotificationTapped(response: Notifications.NotificationResponse): void;
  
  // Preferences
  updatePreferences(prefs: NotificationPreferences): Promise<void>;
  getPreferences(): Promise<NotificationPreferences | null>;
  
  // Testing
  sendTestNotification(): Promise<void>;
  
  // Streaming Availability
  processStreamingAvailabilityNotifications(): Promise<void>;
  
  // Digest Notifications
  processDigestNotifications(): Promise<void>;
  
  // Recommendation Notifications
  processRecommendationNotifications(): Promise<void>;
  processShowStatusNotifications(): Promise<void>;
  processReEngagementNotifications(): Promise<void>;
  
  // User Activity Tracking
  trackUserActivity(activityType: 'app_open' | 'episode_watched' | 'watchlist_update'): Promise<void>;
  
  // Episode Notifications
  processEpisodeNotifications(): Promise<void>;
  
  // Lifecycle
  initialize(): Promise<void>;
  cleanup(): void;
}

class NotificationManagerImpl implements NotificationManager {
  private notificationListener?: { remove(): void };
  private responseListener?: { remove(): void };
  private isInitialized = false;
  private currentUserId?: string;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      this.currentUserId = user?.id;

      // Set up notification listeners
      this.notificationListener = Notifications.addNotificationReceivedListener(
        this.handleNotificationReceived.bind(this)
      );

      this.responseListener = Notifications.addNotificationResponseReceivedListener(
        this.handleNotificationTapped.bind(this)
      );

      // Request permissions if not already granted
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        console.log('Notification permissions not granted');
      }

      this.isInitialized = true;
      console.log('NotificationManager initialized');
    } catch (error) {
      console.error('Failed to initialize NotificationManager:', error);
      throw error;
    }
  }

  cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }
    this.isInitialized = false;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions denied');
        return false;
      }

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'StreamScribe Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
        });
      }

      // Initialize sync service if not already done
      await notificationSyncService.initialize();

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  private async checkPermissions(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  async registerForPushNotifications(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return null;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      // Get push token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });

      console.log('Push token obtained:', token.data);

      // Register token with Supabase
      if (this.currentUserId && token.data) {
        await this.registerTokenWithSupabase(token.data);
      }

      return token.data;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  private async registerTokenWithSupabase(token: string): Promise<void> {
    try {
      if (!this.currentUserId) {
        throw new Error('No user ID available for token registration');
      }

      const { error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: this.currentUserId,
          push_token: token,
          platform: Platform.OS,
          device_id: Device.osInternalBuildId || 'unknown',
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }

      console.log('Push token registered with Supabase');
    } catch (error) {
      console.error('Error registering token with Supabase:', error);
      throw error;
    }
  }

  async scheduleLocalNotification(notification: LocalNotification): Promise<string> {
    try {
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        throw new Error('Notification permissions not granted');
      }

      let trigger: Notifications.NotificationTriggerInput | null = null;
      
      if (notification.trigger) {
        if (notification.trigger.seconds) {
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: notification.trigger.seconds,
          };
        } else if (notification.trigger.date) {
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: notification.trigger.date,
          };
        }
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          sound: 'default',
        },
        trigger,
      });

      console.log('Local notification scheduled:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling local notification:', error);
      throw error;
    }
  }

  handleNotificationReceived(notification: Notifications.Notification): void {
    console.log('Notification received:', notification);
    
    // Process notification based on type
    const notificationType = notification.request.content.data?.type;
    
    switch (notificationType) {
      case 'episode_release':
        this.handleEpisodeNotification(notification);
        break;
      case 'streaming_availability':
        this.handleStreamingNotification(notification);
        break;
      case 'streaming_digest':
        this.handleStreamingDigestNotification(notification);
        break;
      case 'recommendation':
        this.handleRecommendationNotification(notification);
        break;
      case 'progress_sync':
        this.handleProgressSyncNotification(notification);
        break;
      default:
        console.log('Unknown notification type:', notificationType);
    }
  }

  handleNotificationTapped(response: Notifications.NotificationResponse): void {
    console.log('Notification tapped:', response);
    
    const data = response.notification.request.content.data as unknown as DeepLinkPayload;
    
    // Use the deep linking service to handle navigation
    notificationDeepLinkingService.navigateFromPayload(data);
    
    // Track user activity
    this.trackUserActivity('app_open').catch(console.error);
  }

  private handleEpisodeNotification(notification: Notifications.Notification): void {
    // Update local cache with new episode information
    const data = notification.request.content.data;
    console.log('Processing episode notification:', data);
    
    // Could trigger a refresh of the watchlist or episode data
    // This would integrate with the existing progress service
  }

  private handleStreamingNotification(notification: Notifications.Notification): void {
    const data = notification.request.content.data;
    console.log('Processing streaming availability notification:', data);
    
    // Could trigger a refresh of streaming data for the affected content
  }

  private handleStreamingDigestNotification(notification: Notifications.Notification): void {
    const data = notification.request.content.data;
    console.log('Processing streaming digest notification:', data);
    
    // Could trigger a refresh of multiple streaming items or show digest view
  }

  private handleRecommendationNotification(notification: Notifications.Notification): void {
    const data = notification.request.content.data;
    console.log('Processing recommendation notification:', data);
    
    // Handle different types of recommendation notifications
    const recommendationType = data.recommendationType;
    
    switch (recommendationType) {
      case 'new_content':
      case 'weekly_digest':
      case 'trending':
      case 'genre_match':
        // Could trigger a refresh of recommendations or cache new content
        break;
      case 'show_status':
        // Could trigger a refresh of show status or update local cache
        break;
      case 're_engagement':
        // Track that user received re-engagement notification
        this.trackUserActivity('app_open').catch(console.error);
        break;
      default:
        console.log('Unknown recommendation type:', recommendationType);
    }
  }

  private handleProgressSyncNotification(notification: Notifications.Notification): void {
    const data = notification.request.content.data;
    console.log('Processing progress sync notification:', data);
    
    // Could trigger a sync of progress data
  }

  /**
   * Create notification with deep link data
   */
  private createNotificationWithDeepLink(
    title: string,
    body: string,
    payload: DeepLinkPayload,
    scheduledFor?: Date
  ): LocalNotification {
    return {
      id: `notification_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title,
      body,
      data: payload,
      trigger: scheduledFor ? { date: scheduledFor } : undefined,
    };
  }

  async updatePreferences(prefs: NotificationPreferences): Promise<void> {
    try {
      if (!this.currentUserId) {
        throw new Error('No user ID available for updating preferences');
      }

      // Use sync service to handle cross-device synchronization
      await notificationSyncService.updatePreferences(prefs);

      console.log('Notification preferences updated');
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  async getPreferences(): Promise<NotificationPreferences | null> {
    try {
      if (!this.currentUserId) {
        return null;
      }

      // Use sync service to get preferences with cross-device sync
      return await notificationSyncService.getPreferences();
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  private getDefaultPreferences(): NotificationPreferences {
    return {
      userId: this.currentUserId || '',
      episodeReleases: true,
      streamingUpdates: true,
      recommendations: true,
      progressSync: true,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
      frequency: 'immediate',
      updatedAt: new Date().toISOString(),
    };
  }

  async sendTestNotification(): Promise<void> {
    try {
      await this.scheduleLocalNotification({
        id: 'test_notification',
        title: 'StreamScribe Test',
        body: 'This is a test notification to verify your settings are working correctly.',
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
        },
        trigger: {
          seconds: 1,
        },
      });

      console.log('Test notification scheduled');
    } catch (error) {
      console.error('Error sending test notification:', error);
      throw error;
    }
  }

  async processStreamingAvailabilityNotifications(): Promise<void> {
    try {
      console.log('Processing streaming availability notifications...');
      
      // Get all pending streaming availability changes
      const notifications = await streamingAvailabilityNotifications.processAvailabilityChanges();
      
      if (notifications.length === 0) {
        console.log('No streaming availability notifications to process');
        return;
      }

      console.log(`Processing ${notifications.length} streaming availability notifications`);

      // Filter notifications based on user preferences
      const filteredNotifications = await streamingAvailabilityNotifications
        .filterNotificationsByPreferences(notifications);

      if (filteredNotifications.length === 0) {
        console.log('All streaming notifications filtered out by user preferences');
        return;
      }

      // Group notifications to avoid spam
      const { individual, grouped } = await notificationGrouping
        .groupStreamingNotifications(filteredNotifications);

      console.log(`Grouped into ${individual.length} individual and ${grouped.length} digest notifications`);

      // Schedule individual notifications with deep linking
      for (const notification of individual) {
        try {
          const deepLinkPayload: DeepLinkPayload = {
            type: 'streaming_availability',
            contentType: notification.data.contentType,
            showId: notification.data.contentType === 'tv' ? notification.data.contentId : undefined,
            movieId: notification.data.contentType === 'movie' ? notification.data.contentId : undefined,
          };

          const localNotification = this.createNotificationWithDeepLink(
            notification.title,
            notification.body,
            deepLinkPayload,
            notification.scheduledFor ? new Date(notification.scheduledFor) : undefined
          );

          await this.scheduleLocalNotification(localNotification);
        } catch (error) {
          console.error('Error scheduling streaming notification:', error);
        }
      }

      // Schedule digest notifications
      for (const digest of grouped) {
        try {
          await this.scheduleLocalNotification({
            id: digest.id,
            title: digest.title,
            body: digest.body,
            data: {
              type: 'streaming_digest',
              digestType: digest.type,
              notificationCount: digest.notifications.length,
              notifications: digest.notifications,
            },
          });
        } catch (error) {
          console.error('Error scheduling digest notification:', error);
        }
      }

      // Handle scheduled notifications (for quiet hours, etc.)
      const scheduledNotifications = individual.filter(n => n.scheduledFor);
      for (const notification of scheduledNotifications) {
        try {
          const scheduledDate = new Date(notification.scheduledFor!);
          await this.scheduleLocalNotification({
            id: notification.id,
            title: notification.title,
            body: notification.body,
            data: notification.data,
            trigger: {
              date: scheduledDate,
            },
          });
        } catch (error) {
          console.error('Error scheduling delayed streaming notification:', error);
        }
      }

      console.log(`Successfully processed ${individual.length + grouped.length} streaming availability notifications`);
    } catch (error) {
      console.error('Error processing streaming availability notifications:', error);
    }
  }

  async processDigestNotifications(): Promise<void> {
    try {
      console.log('Processing digest notifications...');
      
      // Schedule digest notifications based on user preferences
      const digestNotifications = await notificationGrouping.scheduleDigestNotifications();
      
      if (digestNotifications.length === 0) {
        console.log('No digest notifications to schedule');
        return;
      }

      console.log(`Scheduling ${digestNotifications.length} digest notifications`);

      // Schedule all digest notifications
      for (const digestNotification of digestNotifications) {
        try {
          await this.scheduleLocalNotification(digestNotification);
        } catch (error) {
          console.error('Error scheduling digest notification:', error);
        }
      }

      // Clean up old digests
      await notificationGrouping.cleanupOldDigests();

      console.log(`Successfully scheduled ${digestNotifications.length} digest notifications`);
    } catch (error) {
      console.error('Error processing digest notifications:', error);
    }
  }

  async processRecommendationNotifications(): Promise<void> {
    try {
      console.log('Processing recommendation notifications...');
      
      // Get all types of recommendation notifications
      const [newContentNotifications, trendingNotifications, weeklyDigest] = await Promise.all([
        recommendationNotificationService.processNewContentRecommendations(),
        recommendationNotificationService.processTrendingRecommendations(),
        recommendationNotificationService.generateWeeklyDigest()
      ]);

      const allNotifications = [...newContentNotifications, ...trendingNotifications];
      if (weeklyDigest) {
        allNotifications.push(weeklyDigest);
      }

      if (allNotifications.length === 0) {
        console.log('No recommendation notifications to process');
        return;
      }

      console.log(`Processing ${allNotifications.length} recommendation notifications`);

      // Filter notifications based on user preferences
      const filteredNotifications = await recommendationNotificationService
        .filterNotificationsByPreferences(allNotifications);

      if (filteredNotifications.length === 0) {
        console.log('All recommendation notifications filtered out by user preferences');
        return;
      }

      // Schedule notifications
      for (const notification of filteredNotifications) {
        try {
          if (notification.scheduledFor) {
            // Schedule for later (quiet hours)
            await this.scheduleLocalNotification({
              id: notification.id,
              title: notification.title,
              body: notification.body,
              data: notification.data,
              trigger: {
                date: new Date(notification.scheduledFor)
              }
            });
          } else {
            // Send immediately
            await this.scheduleLocalNotification({
              id: notification.id,
              title: notification.title,
              body: notification.body,
              data: notification.data
            });
          }
        } catch (error) {
          console.error('Error scheduling recommendation notification:', error);
        }
      }

      console.log(`Successfully processed ${filteredNotifications.length} recommendation notifications`);
    } catch (error) {
      console.error('Error processing recommendation notifications:', error);
    }
  }

  async processShowStatusNotifications(): Promise<void> {
    try {
      console.log('Processing show status notifications...');
      
      // Get show status updates
      const statusNotifications = await showStatusNotificationService.processShowStatusUpdates();

      if (statusNotifications.length === 0) {
        console.log('No show status notifications to process');
        return;
      }

      console.log(`Processing ${statusNotifications.length} show status notifications`);

      // Filter notifications based on user preferences
      const filteredNotifications = await showStatusNotificationService
        .filterNotificationsByPreferences(statusNotifications);

      if (filteredNotifications.length === 0) {
        console.log('All show status notifications filtered out by user preferences');
        return;
      }

      // Schedule notifications
      for (const notification of filteredNotifications) {
        try {
          if (notification.scheduledFor) {
            // Schedule for later (quiet hours)
            await this.scheduleLocalNotification({
              id: notification.id,
              title: notification.title,
              body: notification.body,
              data: notification.data,
              trigger: {
                date: new Date(notification.scheduledFor)
              }
            });
          } else {
            // Send immediately
            await this.scheduleLocalNotification({
              id: notification.id,
              title: notification.title,
              body: notification.body,
              data: notification.data
            });
          }
        } catch (error) {
          console.error('Error scheduling show status notification:', error);
        }
      }

      console.log(`Successfully processed ${filteredNotifications.length} show status notifications`);
    } catch (error) {
      console.error('Error processing show status notifications:', error);
    }
  }

  async processReEngagementNotifications(): Promise<void> {
    try {
      console.log('Processing re-engagement notifications...');
      
      // Get re-engagement notifications
      const reEngagementNotifications = await reEngagementNotificationService
        .processReEngagementNotifications();

      if (reEngagementNotifications.length === 0) {
        console.log('No re-engagement notifications to process');
        return;
      }

      console.log(`Processing ${reEngagementNotifications.length} re-engagement notifications`);

      // Calculate optimal timing for notifications
      for (const notification of reEngagementNotifications) {
        try {
          const optimalTime = await reEngagementNotificationService
            .calculateOptimalNotificationTime(this.currentUserId!);

          if (optimalTime) {
            // Schedule for optimal time
            await this.scheduleLocalNotification({
              id: notification.id,
              title: notification.title,
              body: notification.body,
              data: notification.data,
              trigger: {
                date: optimalTime
              }
            });
          } else {
            // Send immediately if no optimal time found
            await this.scheduleLocalNotification({
              id: notification.id,
              title: notification.title,
              body: notification.body,
              data: notification.data
            });
          }
        } catch (error) {
          console.error('Error scheduling re-engagement notification:', error);
        }
      }

      console.log(`Successfully processed ${reEngagementNotifications.length} re-engagement notifications`);
    } catch (error) {
      console.error('Error processing re-engagement notifications:', error);
    }
  }

  async processEpisodeNotifications(): Promise<void> {
    try {
      console.log('Processing episode notifications...');
      
      // The episode notifications are now automatically generated by the episode tracker
      // when new episodes are detected. This method can be used to manually trigger
      // episode notification processing if needed.
      
      const { episodeTracker } = await import('./episodeTracker');
      const newEpisodes = await episodeTracker.checkForNewEpisodes();
      
      if (newEpisodes.length === 0) {
        console.log('No new episodes found for episode notifications');
        return;
      }

      console.log(`Successfully processed episode notifications for ${newEpisodes.length} new episodes`);
    } catch (error) {
      console.error('Error processing episode notifications:', error);
    }
  }

  async trackUserActivity(activityType: 'app_open' | 'episode_watched' | 'watchlist_update'): Promise<void> {
    try {
      if (!this.currentUserId) {
        console.warn('No user ID available for activity tracking');
        return;
      }

      await reEngagementNotificationService.trackUserActivity(this.currentUserId, activityType);
    } catch (error) {
      console.error('Error tracking user activity:', error);
    }
  }
}

// Export singleton instance
export const notificationManager = new NotificationManagerImpl();