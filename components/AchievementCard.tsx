import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { Achievement, AchievementProgress, TIER_COLORS, UserAchievement } from '../types';

interface AchievementCardProps {
  achievement: Achievement;
  userAchievement?: UserAchievement;
  progress?: AchievementProgress;
  onPress: () => void;
}

export const AchievementCard: React.FC<AchievementCardProps> = ({
  achievement,
  userAchievement,
  progress,
  onPress,
}) => {
  const isUnlocked = !!userAchievement;
  const tierColors = TIER_COLORS[achievement.tier];
  
  // Calculate progress percentage
  const progressPercentage = progress?.progress_percentage || 0;
  
  // Format unlock date
  const formatUnlockDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Get tier display name
  const getTierDisplayName = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  return (
    <TouchableOpacity 
      style={[
        styles.container,
        isUnlocked && { borderColor: tierColors.primary }
      ]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Trophy Icon */}
      <View style={[
        styles.iconContainer,
        { backgroundColor: isUnlocked ? tierColors.glow : 'rgba(255, 255, 255, 0.05)' }
      ]}>
        <Ionicons
          name={achievement.icon_name as any}
          size={48}
          color={isUnlocked ? tierColors.primary : Colors.textMuted}
          style={!isUnlocked && styles.lockedIcon}
        />
      </View>

      {/* Achievement Info */}
      <View style={styles.infoContainer}>
        <View style={styles.headerRow}>
          <Text 
            style={[
              styles.name,
              !isUnlocked && styles.lockedText
            ]} 
            numberOfLines={2}
          >
            {achievement.name}
          </Text>
          
          {/* Tier Badge */}
          <View style={[
            styles.tierBadge,
            { backgroundColor: tierColors.primary }
          ]}>
            <Text style={styles.tierText}>
              {getTierDisplayName(achievement.tier)}
            </Text>
          </View>
        </View>

        <Text 
          style={[
            styles.description,
            !isUnlocked && styles.lockedText
          ]} 
          numberOfLines={2}
        >
          {achievement.description}
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

        {/* Unlock Date for Unlocked Achievements */}
        {isUnlocked && userAchievement && (
          <View style={styles.unlockContainer}>
            <Ionicons 
              name="checkmark-circle" 
              size={14} 
              color={tierColors.primary} 
            />
            <Text style={[styles.unlockDate, { color: tierColors.light }]}>
              Unlocked {formatUnlockDate(userAchievement.unlocked_at)}
            </Text>
          </View>
        )}

        {/* Points Display */}
        <View style={styles.pointsContainer}>
          <Ionicons 
            name="star" 
            size={12} 
            color={isUnlocked ? tierColors.primary : Colors.textMuted} 
          />
          <Text style={[
            styles.points,
            isUnlocked && { color: tierColors.primary }
          ]}>
            {achievement.points} pts
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    flexDirection: 'row',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  lockedIcon: {
    opacity: 0.3,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginRight: 8,
  },
  lockedText: {
    opacity: 0.5,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  tierText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000000',
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    minWidth: 35,
    textAlign: 'right',
  },
  unlockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  unlockDate: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  points: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginLeft: 4,
  },
});
