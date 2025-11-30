import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandTokens, Typography, Spacing, BorderRadius, Shadows } from '../constants/BrandTokens';
import { Achievement, TIER_COLORS } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface AchievementNotificationBannerProps {
  achievement: Achievement | null;
  visible: boolean;
  onDismiss: () => void;
  onPress: () => void; // Opens full unlock screen
}

/**
 * AchievementNotificationBanner Component
 * 
 * Compact in-app banner for achievement unlocks (alternative to full screen).
 * Slides down from top of screen with trophy icon and tier styling.
 */
export const AchievementNotificationBanner: React.FC<AchievementNotificationBannerProps> = ({
  achievement,
  visible,
  onDismiss,
  onPress,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pan responder for swipe-up gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical swipes
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow upward swipes
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped up more than 50px, dismiss
        if (gestureState.dy < -50) {
          handleDismiss();
        } else {
          // Otherwise, spring back to original position
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible && achievement) {
      setIsVisible(true);
      
      // Animate in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 15,
          stiffness: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 5 seconds
      dismissTimerRef.current = setTimeout(() => {
        handleDismiss();
      }, 5000);

      return () => {
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
        }
      };
    } else if (!visible) {
      handleDismiss();
    }
  }, [visible, achievement]);

  const handleDismiss = () => {
    // Clear auto-dismiss timer
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
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
      onDismiss();
    });
  };

  const handlePress = () => {
    // Clear auto-dismiss timer
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    onPress();
  };

  if (!isVisible || !achievement) {
    return null;
  }

  const tierColors = TIER_COLORS[achievement.tier];
  const getTierDisplayName = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={styles.touchable}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={[styles.content, { backgroundColor: tierColors.dark }]}>
          {/* Trophy Icon with Glow */}
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.iconGlow,
                { backgroundColor: tierColors.glow },
              ]}
            />
            <Ionicons
              name={achievement.icon_name as any}
              size={40}
              color={tierColors.primary}
            />
          </View>
          
          {/* Text Content */}
          <View style={styles.textContainer}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Achievement Unlocked!</Text>
              <View
                style={[
                  styles.tierBadge,
                  { backgroundColor: tierColors.primary },
                ]}
              >
                <Text style={styles.tierText}>
                  {getTierDisplayName(achievement.tier)}
                </Text>
              </View>
            </View>
            <Text style={styles.achievementName} numberOfLines={1}>
              {achievement.name}
            </Text>
            <View style={styles.pointsRow}>
              <Ionicons name="star" size={14} color={tierColors.primary} />
              <Text style={[styles.points, { color: tierColors.primary }]}>
                +{achievement.points} points
              </Text>
            </View>
          </View>

          {/* Dismiss Button */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="close"
              size={20}
              color={BrandTokens.white}
            />
          </TouchableOpacity>
        </View>

        {/* Swipe Indicator */}
        <View style={styles.swipeIndicator}>
          <View style={styles.swipeBar} />
        </View>
      </TouchableOpacity>
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
    paddingHorizontal: Spacing.md,
  },
  touchable: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.elevated,
  },
  iconContainer: {
    position: 'relative',
    marginRight: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    width: 56,
    height: 56,
  },
  iconGlow: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    opacity: 0.4,
  },
  textContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: BrandTokens.white,
    marginRight: Spacing.sm,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  tierText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  achievementName: {
    ...Typography.body,
    fontWeight: '700',
    color: BrandTokens.white,
    marginBottom: 4,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  points: {
    ...Typography.bodySmall,
    fontWeight: '600',
    marginLeft: 4,
  },
  dismissButton: {
    padding: Spacing.xs,
  },
  swipeIndicator: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  swipeBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});

// Hook for managing achievement notification banner queue
export function useAchievementNotificationBanner() {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const showNotification = (achievement: Achievement) => {
    setQueue(prev => [...prev, achievement]);
  };

  const dismissNotification = () => {
    setIsVisible(false);
    setCurrentAchievement(null);
  };

  const expandToFullScreen = () => {
    // This will be handled by the parent component
    // which should show the AchievementUnlockScreen
    setIsVisible(false);
  };

  // Show next notification when current one is dismissed
  useEffect(() => {
    if (!isVisible && queue.length > 0) {
      const nextAchievement = queue[0];
      setCurrentAchievement(nextAchievement);
      setIsVisible(true);
      
      // Remove from queue after a short delay
      setTimeout(() => {
        setQueue(prev => prev.slice(1));
      }, 100);
    }
  }, [queue, isVisible]);

  const clearQueue = () => {
    setQueue([]);
    setCurrentAchievement(null);
    setIsVisible(false);
  };

  return {
    currentAchievement,
    isVisible,
    showNotification,
    dismissNotification,
    expandToFullScreen,
    clearQueue,
    queueLength: queue.length,
  };
}
