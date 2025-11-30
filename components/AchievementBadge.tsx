import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { achievementsService } from '@/services/achievements';
import { useAuth } from '@/contexts/AuthContext';
import { UserAchievement } from '@/types';

interface AchievementBadgeProps {
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
}

export function AchievementBadge({ size = 'medium', onPress }: AchievementBadgeProps) {
  const { user } = useAuth();
  const [totalUnlocked, setTotalUnlocked] = useState<number>(0);
  const [totalAvailable, setTotalAvailable] = useState<number>(0);
  const [recentAchievement, setRecentAchievement] = useState<UserAchievement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAchievementData();
  }, [user]);

  const loadAchievementData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [stats, userAchievements] = await Promise.all([
        achievementsService.getAchievementStats(user.id),
        achievementsService.getUserAchievements(user.id),
      ]);

      setTotalUnlocked(stats.total_unlocked);
      setTotalAvailable(stats.total_available);

      // Get most recent achievement
      if (stats.recent_achievements && stats.recent_achievements.length > 0) {
        setRecentAchievement(stats.recent_achievements[0]);
      }
    } catch (error) {
      console.error('Error loading achievement data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = () => {
    console.log('AchievementBadge pressed!');
    if (onPress) {
      onPress();
    } else {
      console.log('Navigating to /achievements-list');
      router.push('/achievements-list');
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: styles.containerSmall,
          icon: 20,
          countText: styles.countTextSmall,
          labelText: styles.labelTextSmall,
          recentText: styles.recentTextSmall,
        };
      case 'large':
        return {
          container: styles.containerLarge,
          icon: 32,
          countText: styles.countTextLarge,
          labelText: styles.labelTextLarge,
          recentText: styles.recentTextLarge,
        };
      default:
        return {
          container: styles.containerMedium,
          icon: 24,
          countText: styles.countTextMedium,
          labelText: styles.labelTextMedium,
          recentText: styles.recentTextMedium,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  if (loading) {
    return (
      <TouchableOpacity 
        style={[styles.container, sizeStyles.container]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <ActivityIndicator size="small" color={Colors.primary} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, sizeStyles.container]}
      onPress={handlePress}
      activeOpacity={0.7}
      testID="achievement-badge-button"
    >
      <View style={styles.iconContainer}>
        <Ionicons name="trophy" size={sizeStyles.icon} color="#FFD700" />
        {totalUnlocked > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalUnlocked}</Text>
          </View>
        )}
      </View>

      <View style={styles.textContainer}>
        <Text style={[styles.countText, sizeStyles.countText]}>
          {totalUnlocked}/{totalAvailable}
        </Text>
        <Text style={[styles.labelText, sizeStyles.labelText]}>Achievements</Text>
        
        {recentAchievement && size !== 'small' && (
          <Text style={[styles.recentText, sizeStyles.recentText]} numberOfLines={1}>
            Latest: {recentAchievement.achievement?.name || 'Achievement'}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  containerSmall: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  containerMedium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  containerLarge: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 20,
  },
  iconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  countText: {
    fontWeight: 'bold',
    color: Colors.text,
  },
  countTextSmall: {
    fontSize: 14,
  },
  countTextMedium: {
    fontSize: 18,
  },
  countTextLarge: {
    fontSize: 22,
  },
  labelText: {
    color: Colors.textSecondary,
    marginTop: 2,
  },
  labelTextSmall: {
    fontSize: 11,
  },
  labelTextMedium: {
    fontSize: 13,
  },
  labelTextLarge: {
    fontSize: 15,
  },
  recentText: {
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  recentTextSmall: {
    fontSize: 10,
  },
  recentTextMedium: {
    fontSize: 11,
  },
  recentTextLarge: {
    fontSize: 13,
  },
});
