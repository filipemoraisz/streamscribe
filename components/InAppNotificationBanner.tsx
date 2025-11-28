import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandTokens, Typography, Spacing, BorderRadius, Shadows } from '../constants/BrandTokens';

const { width: screenWidth } = Dimensions.get('window');

export interface InAppNotification {
  id: string;
  type: 'episode_release' | 'streaming_availability' | 'recommendation' | 'progress_sync' | 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  duration?: number; // Auto-dismiss after this many milliseconds
}

export interface InAppNotificationBannerProps {
  notification: InAppNotification | null;
  onDismiss: (id: string) => void;
}

/**
 * InAppNotificationBanner Component
 * 
 * Displays in-app notifications when push notifications are disabled.
 * Provides a fallback mechanism for important updates.
 */
export const InAppNotificationBanner: React.FC<InAppNotificationBannerProps> = ({
  notification,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const translateY = React.useRef(new Animated.Value(-100)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      
      // Animate in
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss if duration is specified
      if (notification.duration) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, notification.duration);

        return () => clearTimeout(timer);
      }
    } else {
      handleDismiss();
    }
  }, [notification]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      if (notification) {
        onDismiss(notification.id);
      }
    });
  };

  const getNotificationStyle = (type: InAppNotification['type']) => {
    switch (type) {
      case 'episode_release':
        return {
          backgroundColor: BrandTokens.ctaPink,
          iconName: 'tv' as const,
          iconColor: BrandTokens.white,
        };
      case 'streaming_availability':
        return {
          backgroundColor: BrandTokens.brandBlue,
          iconName: 'trending-up' as const,
          iconColor: BrandTokens.white,
        };
      case 'recommendation':
        return {
          backgroundColor: BrandTokens.accentPurple,
          iconName: 'star' as const,
          iconColor: BrandTokens.white,
        };
      case 'progress_sync':
        return {
          backgroundColor: BrandTokens.brandLime,
          iconName: 'sync' as const,
          iconColor: BrandTokens.bgDarkGray,
        };
      case 'success':
        return {
          backgroundColor: BrandTokens.success,
          iconName: 'checkmark-circle' as const,
          iconColor: BrandTokens.white,
        };
      case 'warning':
        return {
          backgroundColor: BrandTokens.warning,
          iconName: 'warning' as const,
          iconColor: BrandTokens.bgDarkGray,
        };
      case 'error':
        return {
          backgroundColor: BrandTokens.error,
          iconName: 'alert-circle' as const,
          iconColor: BrandTokens.white,
        };
      default:
        return {
          backgroundColor: BrandTokens.bgDarkGray,
          iconName: 'information-circle' as const,
          iconColor: BrandTokens.white,
        };
    }
  };

  if (!isVisible || !notification) {
    return null;
  }

  const notificationStyle = getNotificationStyle(notification.type);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: notificationStyle.backgroundColor,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={notificationStyle.iconName}
            size={24}
            color={notificationStyle.iconColor}
          />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: notificationStyle.iconColor }]}>
            {notification.title}
          </Text>
          <Text style={[styles.message, { color: notificationStyle.iconColor }]}>
            {notification.message}
          </Text>
        </View>

        <View style={styles.actions}>
          {notification.action && (
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: notificationStyle.iconColor }]}
              onPress={notification.action.onPress}
            >
              <Text style={[styles.actionText, { color: notificationStyle.iconColor }]}>
                {notification.action.label}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="close"
              size={20}
              color={notificationStyle.iconColor}
            />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: 50, // Account for status bar
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    ...Shadows.elevated,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  iconContainer: {
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  title: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    ...Typography.bodySmall,
    opacity: 0.9,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  actionText: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  dismissButton: {
    padding: Spacing.xs,
  },
});

// Hook for managing in-app notifications
export function useInAppNotifications() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [currentNotification, setCurrentNotification] = useState<InAppNotification | null>(null);

  const showNotification = (notification: Omit<InAppNotification, 'id'>) => {
    const newNotification: InAppNotification = {
      ...notification,
      id: Date.now().toString(),
      duration: notification.duration || 5000, // Default 5 seconds
    };

    setNotifications(prev => [...prev, newNotification]);
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (currentNotification?.id === id) {
      setCurrentNotification(null);
    }
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setCurrentNotification(null);
  };

  // Show next notification when current one is dismissed
  useEffect(() => {
    if (!currentNotification && notifications.length > 0) {
      setCurrentNotification(notifications[0]);
    }
  }, [notifications, currentNotification]);

  // Remove current notification from queue when it's dismissed
  useEffect(() => {
    if (currentNotification) {
      const timer = setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== currentNotification.id));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentNotification]);

  return {
    currentNotification,
    showNotification,
    dismissNotification,
    clearAllNotifications,
    hasNotifications: notifications.length > 0,
  };
}