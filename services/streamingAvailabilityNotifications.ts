import { supabase } from './supabase';
import { NotificationPayload, LocalNotification } from '../types';
import { streamingAvailabilityMonitor } from './streamingAvailabilityMonitor';
import { tmdbService } from './tmdb';

interface StreamingNotificationTemplate {
  type: 'content_added' | 'content_removed' | 'content_leaving_soon';
  title: string;
  body: string;
  priority: 'high' | 'normal' | 'low';
}

interface StreamingAvailabilityChange {
  id: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  changeType: 'added' | 'removed' | 'leaving_soon';
  service: {
    id: string;
    name: string;
  };
  detectedAt: string;
  leavingDate?: string;
}

class StreamingAvailabilityNotificationService {
  private readonly NOTIFICATION_TEMPLATES: Record<string, StreamingNotificationTemplate> = {
    content_added: {
      type: 'content_added',
      title: '🎬 New on {serviceName}!',
      body: '{title} is now available on {serviceName}',
      priority: 'normal'
    },
    content_removed: {
      type: 'content_removed',
      title: '⚠️ Leaving {serviceName}',
      body: '{title} is no longer available on {serviceName}',
      priority: 'normal'
    },
    content_leaving_soon: {
      type: 'content_leaving_soon',
      title: '⏰ Leaving {serviceName} Soon',
      body: '{title} will leave {serviceName} in 7 days. Watch it now!',
      priority: 'high'
    }
  };

  /**
   * Process all pending streaming availability changes and generate notifications
   */
  async processAvailabilityChanges(): Promise<NotificationPayload[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        return [];
      }

      // Get user's streaming changes from database
      const { data: changes, error } = await supabase
        .rpc('get_user_streaming_changes', { user_uuid: session.user.id });

      if (error) {
        console.error('Error fetching streaming changes:', error);
        return [];
      }

      if (!changes || changes.length === 0) {
        return [];
      }

      console.log(`Processing ${changes.length} streaming availability changes`);

      // Enrich changes with actual titles and generate notifications
      const notifications: NotificationPayload[] = [];
      const processedChangeIds: number[] = [];

      for (const change of changes) {
        try {
          const notification = await this.createNotificationFromChange(change);
          if (notification) {
            notifications.push(notification);
            processedChangeIds.push(change.id);
          }
        } catch (error) {
          console.error(`Error processing change ${change.id}:`, error);
        }
      }

      // Mark changes as processed
      if (processedChangeIds.length > 0) {
        await supabase.rpc('mark_streaming_changes_processed', { 
          change_ids: processedChangeIds 
        });
      }

      return notifications;
    } catch (error) {
      console.error('Error processing availability changes:', error);
      return [];
    }
  }

  /**
   * Create a notification from a streaming availability change
   */
  private async createNotificationFromChange(change: any): Promise<NotificationPayload | null> {
    try {
      // Get actual title from TMDB
      let actualTitle: string;
      try {
        if (change.media_type === 'movie') {
          const movieDetails = await tmdbService.getMovieDetails(change.tmdb_id);
          actualTitle = movieDetails.title;
        } else {
          const tvDetails = await tmdbService.getTVShowDetails(change.tmdb_id);
          actualTitle = tvDetails.name;
        }
      } catch (error) {
        console.error(`Error fetching title for ${change.media_type} ${change.tmdb_id}:`, error);
        actualTitle = change.title || `${change.media_type} ${change.tmdb_id}`;
      }

      // Determine notification template based on change type
      let templateKey: string;
      switch (change.change_type) {
        case 'added':
          templateKey = 'content_added';
          break;
        case 'removed':
          templateKey = 'content_removed';
          break;
        case 'leaving_soon':
          templateKey = 'content_leaving_soon';
          break;
        default:
          console.warn(`Unknown change type: ${change.change_type}`);
          return null;
      }

      const template = this.NOTIFICATION_TEMPLATES[templateKey];
      if (!template) {
        console.warn(`No template found for: ${templateKey}`);
        return null;
      }

      // Generate notification content
      const title = template.title.replace('{serviceName}', change.service_name);
      const body = template.body
        .replace('{title}', actualTitle)
        .replace('{serviceName}', change.service_name);

      const notification: NotificationPayload = {
        id: `streaming-${change.id}-${Date.now()}`,
        type: 'streaming_availability',
        title,
        body,
        data: {
          changeId: change.id,
          tmdbId: change.tmdb_id,
          mediaType: change.media_type,
          changeType: change.change_type,
          serviceId: change.service_id,
          serviceName: change.service_name,
          actualTitle,
          detectedAt: change.detected_at,
          leavingDate: change.leaving_date,
        },
        priority: template.priority,
      };

      // Add scheduling for leaving_soon notifications
      if (change.change_type === 'leaving_soon' && change.leaving_date) {
        const leavingDate = new Date(change.leaving_date);
        const sevenDaysBefore = new Date(leavingDate.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        // Only schedule if the notification time is in the future
        if (sevenDaysBefore > new Date()) {
          notification.scheduledFor = sevenDaysBefore.toISOString();
        }
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification from change:', error);
      return null;
    }
  }

  /**
   * Generate notifications for content leaving services (7-day warning)
   */
  async generateLeavingNotifications(): Promise<NotificationPayload[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        return [];
      }

      // This would typically be called by a background job that detects
      // content leaving dates from streaming service APIs
      // For now, we'll return empty array as this requires external data sources
      
      console.log('Leaving notifications would be generated here with external data');
      return [];
    } catch (error) {
      console.error('Error generating leaving notifications:', error);
      return [];
    }
  }

  /**
   * Filter notifications based on user preferences
   */
  async filterNotificationsByPreferences(
    notifications: NotificationPayload[]
  ): Promise<NotificationPayload[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        return [];
      }

      // Get user notification preferences
      const { data: preferences } = await supabase
        .from('notification_preferences')
        .select('streaming_updates, quiet_hours')
        .eq('user_id', session.user.id)
        .single();

      // If streaming updates are disabled, return empty array
      if (preferences && !preferences.streaming_updates) {
        return [];
      }

      // Filter by quiet hours if enabled
      if (preferences?.quiet_hours?.enabled) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const [startHour, startMin] = preferences.quiet_hours.start.split(':').map(Number);
        const [endHour, endMin] = preferences.quiet_hours.end.split(':').map(Number);
        
        const quietStart = startHour * 60 + startMin;
        const quietEnd = endHour * 60 + endMin;

        // Check if current time is in quiet hours
        const isQuietTime = quietStart <= quietEnd 
          ? (currentTime >= quietStart && currentTime <= quietEnd)
          : (currentTime >= quietStart || currentTime <= quietEnd);

        if (isQuietTime) {
          // Schedule notifications for after quiet hours
          const nextAllowedTime = new Date();
          if (quietStart <= quietEnd) {
            // Same day quiet hours
            nextAllowedTime.setHours(endHour, endMin, 0, 0);
            if (nextAllowedTime <= now) {
              nextAllowedTime.setDate(nextAllowedTime.getDate() + 1);
            }
          } else {
            // Overnight quiet hours
            if (currentTime >= quietStart) {
              // After start time, schedule for end time tomorrow
              nextAllowedTime.setDate(nextAllowedTime.getDate() + 1);
            }
            nextAllowedTime.setHours(endHour, endMin, 0, 0);
          }

          // Update notification scheduling
          return notifications.map(notification => ({
            ...notification,
            scheduledFor: nextAllowedTime.toISOString()
          }));
        }
      }

      return notifications;
    } catch (error) {
      console.error('Error filtering notifications by preferences:', error);
      return notifications;
    }
  }

  /**
   * Create local notifications for immediate display
   */
  createLocalNotifications(notifications: NotificationPayload[]): LocalNotification[] {
    return notifications
      .filter(notification => !notification.scheduledFor) // Only immediate notifications
      .map(notification => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        data: notification.data,
      }));
  }

  /**
   * Get notification template for a specific change type
   */
  getNotificationTemplate(changeType: string): StreamingNotificationTemplate | null {
    const templateMap: Record<string, string> = {
      'added': 'content_added',
      'removed': 'content_removed',
      'leaving_soon': 'content_leaving_soon'
    };

    const templateKey = templateMap[changeType];
    return templateKey ? this.NOTIFICATION_TEMPLATES[templateKey] : null;
  }

  /**
   * Test notification generation for a specific service
   */
  async generateTestNotification(
    serviceName: string,
    changeType: 'added' | 'removed' | 'leaving_soon' = 'added'
  ): Promise<NotificationPayload> {
    const template = this.getNotificationTemplate(changeType);
    if (!template) {
      throw new Error(`No template found for change type: ${changeType}`);
    }

    const title = template.title.replace('{serviceName}', serviceName);
    const body = template.body
      .replace('{title}', 'Test Movie')
      .replace('{serviceName}', serviceName);

    return {
      id: `test-streaming-${Date.now()}`,
      type: 'streaming_availability',
      title,
      body,
      data: {
        test: true,
        changeType,
        serviceName,
      },
      priority: template.priority,
    };
  }

  /**
   * Get statistics about streaming notifications
   */
  async getNotificationStats(): Promise<{
    totalChangesProcessed: number;
    notificationsSent: number;
    lastProcessedAt: string | null;
  }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        return {
          totalChangesProcessed: 0,
          notificationsSent: 0,
          lastProcessedAt: null,
        };
      }

      // Get processed changes count
      const { count: processedCount } = await supabase
        .from('streaming_availability_changes')
        .select('*', { count: 'exact', head: true })
        .eq('processed', true);

      // Get last processed timestamp
      const { data: lastProcessed } = await supabase
        .from('streaming_availability_changes')
        .select('detected_at')
        .eq('processed', true)
        .order('detected_at', { ascending: false })
        .limit(1)
        .single();

      return {
        totalChangesProcessed: processedCount || 0,
        notificationsSent: processedCount || 0, // Assuming 1:1 ratio for now
        lastProcessedAt: lastProcessed?.detected_at || null,
      };
    } catch (error) {
      console.error('Error getting notification stats:', error);
      return {
        totalChangesProcessed: 0,
        notificationsSent: 0,
        lastProcessedAt: null,
      };
    }
  }
}

export const streamingAvailabilityNotifications = new StreamingAvailabilityNotificationService();