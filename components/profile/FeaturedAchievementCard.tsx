import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Achievement, AchievementProgress, UserAchievement, TIER_COLORS } from '../../types';

interface FeaturedAchievementCardProps {
  achievement: Achievement;
  userAchievement?: UserAchievement;
  progress?: AchievementProgress;
  onPress: () => void;
}

export const FeaturedAchievementCard: React.FC<FeaturedAchievementCardProps> = ({
  achievement,
  userAchievement,
  progress,
  onPress,
}) => {
  const isUnlocked = !!userAchievement;
  const tierColors = TIER_COLORS[achievement.tier];
  const progressPercentage = progress?.progress_percentage || 0;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isUnlocked && { borderColor: tierColors.primary }
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Icon Container */}
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: isUnlocked ? tierColors.glow : 'rgba(255, 255, 255, 0.05)' }
        ]}
      >
        <Ionicons
          name={achievement.icon_name as any}
          size={40}
          color={isUnlocked ? tierColors.primary : Colors.textMuted}
          style={!isUnlocked && styles.lockedIcon}
        />
      </View>

      {/* Achievement Name */}
      <Text
        style={[
          styles.name,
          !isUnlocked && styles.lockedText
        ]}
        numberOfLines={2}
      >
        {achievement.name}
      </Text>

      {/* Progress Bar for Locked Achievements */}
      {!isUnlocked && progress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(progressPercentage, 100)}%`,
                  backgroundColor: tierColors.primary
                }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progressPercentage)}%
          </Text>
        </View>
      )}

      {/* Unlock Badge for Unlocked Achievements */}
      {isUnlocked && (
        <View style={styles.unlockedBadge}>
          <Ionicons
            name="checkmark-circle"
            size={16}
            color={tierColors.primary}
          />
          <Text style={[styles.unlockedText, { color: tierColors.light }]}>
            Unlocked
          </Text>
        </View>
      )}

      {/* Points Display */}
      <View style={styles.pointsContainer}>
        <Ionicons
          name="star"
          size={14}
          color={isUnlocked ? tierColors.primary : Colors.textMuted}
        />
        <Text
          style={[
            styles.points,
            isUnlocked && { color: tierColors.primary }
          ]}
        >
          {achievement.points} pts
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 160,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  lockedIcon: {
    opacity: 0.3,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
    minHeight: 36,
  },
  lockedText: {
    opacity: 0.5,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 8,
  },
  progressBarBackground: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  unlockedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  points: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
