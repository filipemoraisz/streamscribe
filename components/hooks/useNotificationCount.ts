import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { notificationHistoryService } from '../../services/notificationHistory';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Hook for managing unread notification count
 * 
 * Provides reactive state for unread notification count and refresh functionality.
 * Automatically refreshes when screen focuses.
 */
export function useNotificationCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      setIsLoading(true);
      const count = await notificationHistoryService.getUnreadCount(user.id);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread notification count:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Refresh count when screen focuses
  useFocusEffect(
    useCallback(() => {
      refreshCount();
    }, [refreshCount])
  );

  // Initial load
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  return {
    unreadCount,
    isLoading,
    refreshCount,
  };
}

/**
 * Hook for managing notification count with manual refresh capability
 */
export function useNotificationCountWithRefresh() {
  const { unreadCount, isLoading, refreshCount } = useNotificationCount();
  
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationHistoryService.markAsRead(notificationId);
      // Refresh count after marking as read
      await refreshCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [refreshCount]);

  const markAllAsRead = useCallback(async (userId: string) => {
    try {
      await notificationHistoryService.markAllAsRead(userId);
      // Refresh count after marking all as read
      await refreshCount();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [refreshCount]);

  return {
    unreadCount,
    isLoading,
    refreshCount,
    markAsRead,
    markAllAsRead,
  };
}