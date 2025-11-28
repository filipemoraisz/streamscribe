import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { NotificationPayload, LocalNotification } from '../types';

interface NotificationGroup {
  id: string;
  type: 'streaming_service' | 'availability_type' | 'daily_digest' | 'weekly_digest';
  groupKey: string; // service_id, change_type, or date
  notifications: NotificationPayload[];
  createdAt: string;
  scheduledFor?: string;
}

interface DigestNotification {
  id: string;
  title: string;
  body: string;
  notifications: NotificationPayload[];
  type: 'daily' | 'weekly';
  scheduledFor: string;
}

class NotificationGroupingService {
  private readonly GROUPING_CACHE_KEY = 'notification_groups';
  private readonly DIGEST_CACHE_KEY = 'digest_notifications';
  private readonly MAX_INDIVIDUAL_NOTIFICATIONS = 3; // After this, group into digest
  private readonly GROUPING_WINDOW = 2 * 60 * 60 * 1000; // 2 hours

  /**
   * Group streaming availability notifications to avoid spam
   */
  async groupStreamingNotifications(
    notifications: NotificationPayload[]
  ): Promise<{
    individual: NotificationPayload[];
    grouped: DigestNotification[];
  }> {
    try {
      if (notifications.length === 0) {
        return { individual: [], grouped: [] };
      }

      // Filter only streaming availability notifications
      const streamingNotifications = notifications.filter(n => n.type === 'streaming_availability');
      const otherNotifications = notifications.filter(n => n.type !== 'streaming_availability');

      if (streamingNotifications.length === 0) {
        return { individual: notifications, grouped: [] };
      }

      // Group by service and change type
      const groups = this.groupNotificationsByService(streamingNotifications);
      
      const individual: NotificationPayload[] = [...otherNotifications];
      const grouped: DigestNotification[] = [];

      for (const group of groups) {
        if (group.notifications.length <= this.MAX_INDIVIDUAL_NOTIFICATIONS) {
          // Send individual notifications
          individual.push(...group.notifications);
        } else {
          // Create digest notification
          const digest = this.createServiceDigest(group);
          grouped.push(digest);
        }
      }

      return { individual, grouped };
    } catch (error) {
      console.error('Error grouping streaming notifications:', error);
      return { individual: notifications, grouped: [] };
    }
  }

  /**
   * Group notifications by streaming service
   */
  private groupNotificationsByService(notifications: NotificationPayload[]): NotificationGroup[] {
    const serviceGroups = new Map<string, NotificationPayload[]>();

    notifications.forEach(notification => {
      const serviceId = notification.data?.serviceId || 'unknown';
      if (!serviceGroups.has(serviceId)) {
        serviceGroups.set(serviceId, []);
      }
      serviceGroups.get(serviceId)!.push(notification);
    });

    return Array.from(serviceGroups.entries()).map(([serviceId, notifs]) => ({
      id: `service-${serviceId}-${Date.now()}`,
      type: 'streaming_service' as const,
      groupKey: serviceId,
      notifications: notifs,
      createdAt: new Date().toISOString(),
    }));
  }

  /**
   * Create a digest notification for a service group
   */
  private createServiceDigest(group: NotificationGroup): DigestNotification {
    const serviceName = group.notifications[0]?.data?.serviceName || 'Streaming Service';
    const addedCount = group.notifications.filter(n => n.data?.changeType === 'added').length;
    const removedCount = group.notifications.filter(n => n.data?.changeType === 'removed').length;
    const leavingCount = group.notifications.filter(n => n.data?.changeType === 'leaving_soon').length;

    let title = `📺 ${serviceName} Updates`;
    let body = '';

    const parts: string[] = [];
    if (addedCount > 0) {
      parts.push(`${addedCount} new title${addedCount > 1 ? 's' : ''} added`);
    }
    if (removedCount > 0) {
      parts.push(`${removedCount} title${removedCount > 1 ? 's' : ''} removed`);
    }
    if (leavingCount > 0) {
      parts.push(`${leavingCount} title${leavingCount > 1 ? 's' : ''} leaving soon`);
    }

    body = parts.join(', ');

    // Add specific titles if not too many
    if (group.notifications.length <= 5) {
      const titles = group.notifications
        .map(n => n.data?.actualTitle)
        .filter(Boolean)
        .slice(0, 3);
      
      if (titles.length > 0) {
        body += `. Including: ${titles.join(', ')}`;
        if (group.notifications.length > 3) {
          body += ` and ${group.notifications.length - 3} more`;
        }
      }
    }

    return {
      id: `digest-${group.id}`,
      title,
      body,
      notifications: group.notifications,
      type: 'daily',
      scheduledFor: new Date().toISOString(),
    };
  }

  /**
   * Create daily digest notifications
   */
  async createDailyDigest(): Promise<DigestNotification[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        return [];
      }

      // Get user's notification preferences
      const { data: preferences } = await supabase
        .from('notification_preferences')
        .select('frequency, streaming_updates')
        .eq('user_id', session.user.id)
        .single();

      // Only create digest if user prefers daily notifications
      if (!preferences?.streaming_updates || preferences.frequency !== 'daily') {
        return [];
      }

      // Get unprocessed streaming changes from the last 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: changes } = await supabase
        .rpc('get_user_streaming_changes', { user_uuid: session.user.id });

      if (!changes || changes.length === 0) {
        return [];
      }

      // Filter changes from the last 24 hours
      const recentChanges = changes.filter((change: any) => 
        new Date(change.detected_at) >= new Date(yesterday)
      );

      if (recentChanges.length === 0) {
        return [];
      }

      // Group changes by service
      const serviceGroups = new Map<string, any[]>();
      recentChanges.forEach((change: any) => {
        if (!serviceGroups.has(change.service_id)) {
          serviceGroups.set(change.service_id, []);
        }
        serviceGroups.get(change.service_id)!.push(change);
      });

      const digests: DigestNotification[] = [];

      // Create digest for each service with changes
      for (const [serviceId, serviceChanges] of Array.from(serviceGroups.entries())) {
        const serviceName = serviceChanges[0]?.service_name || 'Streaming Service';
        
        const addedCount = serviceChanges.filter((c: any) => c.change_type === 'added').length;
        const removedCount = serviceChanges.filter((c: any) => c.change_type === 'removed').length;
        const leavingCount = serviceChanges.filter((c: any) => c.change_type === 'leaving_soon').length;

        if (addedCount + removedCount + leavingCount === 0) continue;

        let title = `📺 Daily ${serviceName} Update`;
        let body = '';

        const parts: string[] = [];
        if (addedCount > 0) {
          parts.push(`${addedCount} new title${addedCount > 1 ? 's' : ''}`);
        }
        if (removedCount > 0) {
          parts.push(`${removedCount} removed`);
        }
        if (leavingCount > 0) {
          parts.push(`${leavingCount} leaving soon`);
        }

        body = `${parts.join(', ')} on ${serviceName}`;

        // Convert changes to notification format for storage
        const notifications: NotificationPayload[] = serviceChanges.map((change: any) => ({
          id: `change-${change.id}`,
          type: 'streaming_availability',
          title: `${change.change_type} on ${serviceName}`,
          body: `${change.title} ${change.change_type} on ${serviceName}`,
          data: {
            changeId: change.id,
            tmdbId: change.tmdb_id,
            mediaType: change.media_type,
            changeType: change.change_type,
            serviceId: change.service_id,
            serviceName: change.service_name,
            actualTitle: change.title,
          },
          priority: 'normal',
        }));

        digests.push({
          id: `daily-digest-${serviceId}-${Date.now()}`,
          title,
          body,
          notifications,
          type: 'daily',
          scheduledFor: new Date().toISOString(),
        });
      }

      return digests;
    } catch (error) {
      console.error('Error creating daily digest:', error);
      return [];
    }
  }

  /**
   * Create weekly digest notifications
   */
  async createWeeklyDigest(): Promise<DigestNotification[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        return [];
      }

      // Get user's notification preferences
      const { data: preferences } = await supabase
        .from('notification_preferences')
        .select('frequency, streaming_updates')
        .eq('user_id', session.user.id)
        .single();

      // Only create digest if user prefers weekly notifications
      if (!preferences?.streaming_updates || preferences.frequency !== 'weekly') {
        return [];
      }

      // Get unprocessed streaming changes from the last 7 days
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: changes } = await supabase
        .rpc('get_user_streaming_changes', { user_uuid: session.user.id });

      if (!changes || changes.length === 0) {
        return [];
      }

      // Filter changes from the last week
      const weeklyChanges = changes.filter((change: any) => 
        new Date(change.detected_at) >= new Date(lastWeek)
      );

      if (weeklyChanges.length === 0) {
        return [];
      }

      // Create a single weekly digest
      const totalAdded = weeklyChanges.filter((c: any) => c.change_type === 'added').length;
      const totalRemoved = weeklyChanges.filter((c: any) => c.change_type === 'removed').length;
      const totalLeaving = weeklyChanges.filter((c: any) => c.change_type === 'leaving_soon').length;

      const services = new Set(weeklyChanges.map((c: any) => c.service_name));
      const serviceList = Array.from(services).slice(0, 3).join(', ');
      const moreServices = services.size > 3 ? ` and ${services.size - 3} more` : '';

      let title = '📺 Weekly Streaming Update';
      let body = '';

      const parts: string[] = [];
      if (totalAdded > 0) {
        parts.push(`${totalAdded} new titles`);
      }
      if (totalRemoved > 0) {
        parts.push(`${totalRemoved} removed`);
      }
      if (totalLeaving > 0) {
        parts.push(`${totalLeaving} leaving soon`);
      }

      body = `${parts.join(', ')} across ${serviceList}${moreServices}`;

      // Convert changes to notification format
      const notifications: NotificationPayload[] = weeklyChanges.map((change: any) => ({
        id: `weekly-change-${change.id}`,
        type: 'streaming_availability',
        title: `${change.change_type} on ${change.service_name}`,
        body: `${change.title} ${change.change_type} on ${change.service_name}`,
        data: {
          changeId: change.id,
          tmdbId: change.tmdb_id,
          mediaType: change.media_type,
          changeType: change.change_type,
          serviceId: change.service_id,
          serviceName: change.service_name,
          actualTitle: change.title,
        },
        priority: 'normal',
      }));

      return [{
        id: `weekly-digest-${Date.now()}`,
        title,
        body,
        notifications,
        type: 'weekly',
        scheduledFor: new Date().toISOString(),
      }];
    } catch (error) {
      console.error('Error creating weekly digest:', error);
      return [];
    }
  }

  /**
   * Schedule digest notifications based on user preferences
   */
  async scheduleDigestNotifications(): Promise<LocalNotification[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        return [];
      }

      const { data: preferences } = await supabase
        .from('notification_preferences')
        .select('frequency, quiet_hours')
        .eq('user_id', session.user.id)
        .single();

      if (!preferences) {
        return [];
      }

      const localNotifications: LocalNotification[] = [];

      // Create appropriate digest based on frequency preference
      let digests: DigestNotification[] = [];
      
      if (preferences.frequency === 'daily') {
        digests = await this.createDailyDigest();
      } else if (preferences.frequency === 'weekly') {
        digests = await this.createWeeklyDigest();
      }

      // Convert digests to local notifications
      for (const digest of digests) {
        let scheduledDate = new Date(digest.scheduledFor);

        // Respect quiet hours
        if (preferences.quiet_hours?.enabled) {
          scheduledDate = this.adjustForQuietHours(scheduledDate, preferences.quiet_hours);
        }

        localNotifications.push({
          id: digest.id,
          title: digest.title,
          body: digest.body,
          data: {
            type: 'streaming_digest',
            digestType: digest.type,
            notificationCount: digest.notifications.length,
            notifications: digest.notifications,
          },
          trigger: {
            date: scheduledDate,
          },
        });
      }

      return localNotifications;
    } catch (error) {
      console.error('Error scheduling digest notifications:', error);
      return [];
    }
  }

  /**
   * Adjust notification time to respect quiet hours
   */
  private adjustForQuietHours(
    scheduledDate: Date, 
    quietHours: { start: string; end: string }
  ): Date {
    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);

    const scheduledTime = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
    const quietStart = startHour * 60 + startMin;
    const quietEnd = endHour * 60 + endMin;

    // Check if scheduled time is in quiet hours
    const isInQuietHours = quietStart <= quietEnd 
      ? (scheduledTime >= quietStart && scheduledTime <= quietEnd)
      : (scheduledTime >= quietStart || scheduledTime <= quietEnd);

    if (isInQuietHours) {
      // Schedule for after quiet hours
      const adjustedDate = new Date(scheduledDate);
      
      if (quietStart <= quietEnd) {
        // Same day quiet hours
        adjustedDate.setHours(endHour, endMin, 0, 0);
        if (adjustedDate <= scheduledDate) {
          adjustedDate.setDate(adjustedDate.getDate() + 1);
        }
      } else {
        // Overnight quiet hours
        if (scheduledTime >= quietStart) {
          // After start time, schedule for end time next day
          adjustedDate.setDate(adjustedDate.getDate() + 1);
        }
        adjustedDate.setHours(endHour, endMin, 0, 0);
      }

      return adjustedDate;
    }

    return scheduledDate;
  }

  /**
   * Get grouping statistics
   */
  async getGroupingStats(): Promise<{
    totalNotifications: number;
    groupedNotifications: number;
    digestsCreated: number;
    lastDigestTime: string | null;
  }> {
    try {
      // This would typically track statistics in a database
      // For now, return mock data
      return {
        totalNotifications: 0,
        groupedNotifications: 0,
        digestsCreated: 0,
        lastDigestTime: null,
      };
    } catch (error) {
      console.error('Error getting grouping stats:', error);
      return {
        totalNotifications: 0,
        groupedNotifications: 0,
        digestsCreated: 0,
        lastDigestTime: null,
      };
    }
  }

  /**
   * Clear old digest notifications
   */
  async cleanupOldDigests(): Promise<void> {
    try {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      // Clean up local storage
      const digestData = await AsyncStorage.getItem(this.DIGEST_CACHE_KEY);
      if (digestData) {
        const digests: DigestNotification[] = JSON.parse(digestData);
        const recentDigests = digests.filter(digest => 
          new Date(digest.scheduledFor).getTime() > thirtyDaysAgo
        );
        
        await AsyncStorage.setItem(this.DIGEST_CACHE_KEY, JSON.stringify(recentDigests));
      }

      console.log('Cleaned up old digest notifications');
    } catch (error) {
      console.error('Error cleaning up old digests:', error);
    }
  }
}

export const notificationGrouping = new NotificationGroupingService();