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

  // Get notification color based on type
  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'episode_release':
        return '#FF5C00'; // Primary orange
      case 'streaming_availability':
        return '#FF7A33'; // Light orange
      case 'recommendation':
        return '#FF5C00'; // Primary orange
      case 'progress_sync':
        return '#FF8F4D'; // Warm orange
      case 'achievement_unlock':
        return '#FF5C00'; // Primary orange
      default:
        return Colors.primary;
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

  // Render notification item (non-clickable, display only)
  const renderNotificationItem = ({ item }: { item: NotificationItem }) => {
    const notificationColor = getNotificationColor(item.type);
    
    return (
      <View style={[
        styles.notificationItem, 
        !item.read && styles.unreadItem,
        { borderLeftColor: notificationColor, borderLeftWidth: 4 }
      ]}>
        <View style={styles.notificationContent}>
          <View style={[styles.iconContainer, { backgroundColor: notificationColor }]}>
            <Ionicons
              name={getNotificationIcon(item.type) as any}
              size={26}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.textContainer}>
            <View style={styles.notificationHeader}>
              <Text style={[styles.notificationTitle, !item.read && styles.unreadText]} numberOfLines={2}>
                {item.title}
              </Text>
              {!item.read && <View style={[styles.unreadDot, { backgroundColor: notificationColor }]} />}
            </View>

            <Text style={styles.notificationBody} numberOfLines={3}>
              {item.body}
            </Text>

            <View style={styles.notificationFooter}>
              <View style={[styles.typeTag, { backgroundColor: notificationColor + '15', borderColor: notificationColor + '40' }]}>
                <Text style={[styles.typeTagText, { color: notificationColor }]}>
                  {item.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
              </View>
              <Text style={styles.timestamp}>
                {formatTimestamp(item.timestamp)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

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
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadItem: {
    backgroundColor: Colors.surface,
    shadowOpacity: 0.15,
    elevation: 4,
  },
  colorAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingLeft: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
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
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  notificationBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  typeTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 8,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyListContainer: {
    flexGrow: 1,
    paddingTop: 20,
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