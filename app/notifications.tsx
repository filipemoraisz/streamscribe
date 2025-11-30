import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { Colors } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { notificationHistoryService } from '../services/notificationHistory';

interface NotificationItem {
  id: string;
  type: 'episode_release' | 'streaming_availability' | 'recommendation' | 'progress_sync' | 'achievement_unlock';
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  data?: any;
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load notification history
  const loadNotifications = useCallback(async (showRefresh = true) => {
    if (!user) {
      console.log('No user found, skipping notification load');
      setIsLoading(false);
      return;
    }

    try {
      if (showRefresh) setIsRefreshing(true);

      console.log('Loading notifications for user:', user.id);

      // Get notification history from database
      const dbNotifications = await notificationHistoryService.getNotificationHistory(user.id, 100);

      console.log('Fetched notifications from DB:', dbNotifications.length, dbNotifications);

      // Convert database notifications to UI format
      const uiNotifications: NotificationItem[] = dbNotifications.map(dbNotif => ({
        id: dbNotif.id,
        type: dbNotif.type,
        title: dbNotif.title,
        body: dbNotif.body,
        timestamp: dbNotif.created_at,
        read: dbNotif.read_at ? true : false,
        data: dbNotif.data,
      }));

      console.log('Converted UI notifications:', uiNotifications.length, uiNotifications);
      setNotifications(uiNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  // Load data when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  // Mark notification as read and handle navigation
  const handleNotificationTap = async (notification: NotificationItem) => {
    try {
      // Mark as read if not already read
      if (!notification.read) {
        await notificationHistoryService.markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notification.id ? { ...notif, read: true } : notif
          )
        );
      }

      // Navigate based on notification type and data
      if (notification.data?.deepLink) {
        const { screen, params } = notification.data.deepLink;
        if (screen === 'EpisodeDetails' && params.showId) {
          router.push(`/details/tv/${params.showId}`);
        } else if (screen === 'ShowDetails' && params.showId) {
          router.push(`/details/tv/${params.showId}`);
        }
      } else {
        // Default navigation based on type
        switch (notification.type) {
          case 'episode_release':
            if (notification.data?.showId) {
              router.push(`/details/tv/${notification.data.showId}`);
            }
            break;
          case 'streaming_availability':
            if (notification.data?.showId) {
              router.push(`/details/tv/${notification.data.showId}`);
            } else if (notification.data?.movieId) {
              router.push(`/details/movie/${notification.data.movieId}`);
            }
            break;
          case 'recommendation':
            router.push('/(tabs)');
            break;
          default:
            router.push('/(tabs)');
        }
      }
    } catch (error) {
      console.error('Error handling notification tap:', error);
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'episode_release':
        return 'tv';
      case 'streaming_availability':
        return 'play-circle';
      case 'recommendation':
        return 'star';
      case 'progress_sync':
        return 'sync';
      default:
        return 'notifications';
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  // Render notification item
  const renderNotificationItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.read && styles.unreadItem]}
      onPress={() => handleNotificationTap(item)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationContent}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={getNotificationIcon(item.type) as any}
            size={24}
            color={!item.read ? Colors.primary : Colors.textMuted}
          />
        </View>

        <View style={styles.textContainer}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.notificationTitle, !item.read && styles.unreadText]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.timestamp}>
              {formatTimestamp(item.timestamp)}
            </Text>
          </View>

          <Text style={styles.notificationBody} numberOfLines={3}>
            {item.body}
          </Text>
        </View>

        {!item.read && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </View>
    );
  }

  // Create test notification for debugging
  const createTestNotification = async () => {
    if (!user) return;

    try {
      await notificationHistoryService.storeNotification({
        user_id: user.id,
        type: 'episode_release',
        title: 'New Episode Available!',
        body: 'Season 2 Episode 5 of your favorite show is now available to watch.',
        data: { showId: '12345', episodeId: '67890' },
        status: 'sent'
      });

      // Reload notifications
      loadNotifications(false);
    } catch (error) {
      console.error('Error creating test notification:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerBackTitle: 'Back',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/notification-settings' as any)}
              style={styles.headerButton}
            >
              <Ionicons name="settings-outline" size={24} color={Colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadNotifications()}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              You&apos;ll see your notification history here
            </Text>
            <TouchableOpacity onPress={createTestNotification} style={styles.createTestButton}>
              <Text style={styles.createTestButtonText}>Create Test Notification</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={notifications.length === 0 ? styles.emptyListContainer : undefined}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerButton: {
    padding: 8,
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  notificationItem: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  unreadItem: {
    backgroundColor: Colors.surface,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
    lineHeight: 22,
  },
  unreadText: {
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  notificationBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 8,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  createTestButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  createTestButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});