import { supabase } from './supabase';

export interface NotificationHistoryItem {
  id: string;
  user_id: string;
  type: 'episode_release' | 'streaming_availability' | 'recommendation' | 'progress_sync';
  title: string;
  body: string;
  data: any;
  scheduled_for?: string;
  sent_at?: string;
  read_at?: string;
  priority: 'high' | 'normal' | 'low';
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export class NotificationHistoryService {
  
  /**
   * Get notification history for a user
   */
  async getNotificationHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<NotificationHistoryItem[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching notification history:', error);
      return [];
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      // First check if read_at column exists by trying to query it
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'sent');

      if (error) {
        // If read_at column doesn't exist, return 0 for now
        console.warn('read_at column may not exist yet:', error);
        return 0;
      }

      // If read_at column exists, filter by it
      try {
        const { count: unreadCount, error: unreadError } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .is('read_at', null)
          .eq('status', 'sent');

        if (unreadError) {
          // Fallback: return total count if read_at filtering fails
          return count || 0;
        }

        return unreadCount || 0;
      } catch (readAtError) {
        // Fallback: return total count if read_at column doesn't exist
        return count || 0;
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      // Try to update read_at column if it exists
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) {
        // If read_at column doesn't exist, we can still track read status in local storage
        console.warn('Could not update read_at column, may not exist yet:', error);
        // You could implement local storage fallback here if needed
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Don't throw error to prevent UI from breaking
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      // Try to update read_at column if it exists
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) {
        console.warn('Could not update read_at column, may not exist yet:', error);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      // Don't throw error to prevent UI from breaking
    }
  }

  /**
   * Store a notification in the database
   */
  async storeNotification(notification: {
    user_id: string;
    type: string;
    title: string;
    body: string;
    data?: any;
    scheduled_for?: string;
    priority?: 'high' | 'normal' | 'low';
    status?: 'pending' | 'sent' | 'failed' | 'cancelled';
  }): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: notification.user_id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          scheduled_for: notification.scheduled_for,
          priority: notification.priority || 'normal',
          status: notification.status || 'pending',
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return data?.id || null;
    } catch (error) {
      console.error('Error storing notification:', error);
      return null;
    }
  }

  /**
   * Update notification status
   */
  async updateNotificationStatus(
    notificationId: string,
    status: 'pending' | 'sent' | 'failed' | 'cancelled'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status })
        .eq('id', notificationId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error updating notification status:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics for a user
   */
  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    recentActivity: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
  }> {
    try {
      // Get all notifications for the user
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('type, status, created_at')
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      const stats = {
        total: notifications?.length || 0,
        unread: 0,
        byType: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
        recentActivity: {
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
        },
      };

      if (!notifications) return stats;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      notifications.forEach(notification => {
        // Count by type
        stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
        
        // Count by status
        stats.byStatus[notification.status] = (stats.byStatus[notification.status] || 0) + 1;
        
        // Count unread (for now, we'll consider all 'sent' notifications as potentially unread)
        // This will be more accurate once read_at column is added
        if (notification.status === 'sent') {
          stats.unread++;
        }

        // Count recent activity
        const createdAt = new Date(notification.created_at);
        if (createdAt >= today) {
          stats.recentActivity.today++;
        }
        if (createdAt >= thisWeek) {
          stats.recentActivity.thisWeek++;
        }
        if (createdAt >= thisMonth) {
          stats.recentActivity.thisMonth++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error fetching notification stats:', error);
      return {
        total: 0,
        unread: 0,
        byType: {},
        byStatus: {},
        recentActivity: { today: 0, thisWeek: 0, thisMonth: 0 },
      };
    }
  }

  /**
   * Delete old notifications (cleanup)
   */
  async deleteOldNotifications(userId: string, olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        throw error;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Error deleting old notifications:', error);
      return 0;
    }
  }

  /**
   * Subscribe to real-time notification changes
   */
  subscribeToNotifications(
    userId: string,
    callback: (notification: NotificationHistoryItem) => void
  ) {
    const subscription = supabase
      .channel(`notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as NotificationHistoryItem);
        }
      )
      .subscribe();

    return subscription;
  }
}

// Export singleton instance
export const notificationHistoryService = new NotificationHistoryService();