import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Achievement, UserAchievement, AchievementProgress } from '../types';
import { supabase } from '../services/supabase';

const { width } = Dimensions.get('window');

interface AchievementDetailModalProps {
  achievement: Achievement;
  userAchievement?: UserAchievement;
  progress?: AchievementProgress;
  visible: boolean;
  onClose: () => void;
}

const TIER_COLORS = {
  bronze: {
    primary: '#CD7F32',
    light: '#E6A85C',
    dark: '#8B5A2B',
    glow: 'rgba(205, 127, 50, 0.3)',
  },
  silver: {
    primary: '#C0C0C0',
    light: '#E8E8E8',
    dark: '#808080',
    glow: 'rgba(192, 192, 192, 0.3)',
  },
  gold: {
    primary: '#FFD700',
    light: '#FFED4E',
    dark: '#B8860B',
    glow: 'rgba(255, 215, 0, 0.4)',
  },
  platinum: {
    primary: '#E5E4E2',
    light: '#FFFFFF',
    dark: '#A8A8A8',
    glow: 'rgba(229, 228, 226, 0.5)',
  },
};

export default function AchievementDetailModal({
  achievement,
  userAchievement,
  progress,
  visible,
  onClose,
}: AchievementDetailModalProps) {
  const [rarityPercentage, setRarityPercentage] = useState<number | null>(null);
  const isUnlocked = !!userAchievement;
  const tierColors = TIER_COLORS[achievement.tier];

  useEffect(() => {
    if (visible) {
      calculateRarity();
    }
  }, [visible, achievement.id]);

  const calculateRarity = async () => {
    try {
      // Get total users count
      const { count: totalUsers, error: totalError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      // Get users who unlocked this achievement
      const { count: unlockedCount, error: unlockedError } = await supabase
        .from('user_achievements')
        .select('*', { count: 'exact', head: true })
        .eq('achievement_id', achievement.id);

      if (unlockedError) throw unlockedError;

      if (totalUsers && totalUsers > 0) {
        const percentage = ((unlockedCount || 0) / totalUsers) * 100;
        setRarityPercentage(Math.round(percentage * 10) / 10); // Round to 1 decimal
      }
    } catch (error) {
      console.error('Error calculating rarity:', error);
      setRarityPercentage(null);
    }
  };

  const formatUnlockCriteria = () => {
    const { type, value } = achievement.unlock_criteria;
    
    switch (type) {
      case 'episode_count':
        return `Watch ${value} episode${value !== 1 ? 's' : ''}`;
      case 'streak_days':
        return `Maintain a ${value}-day viewing streak`;
      case 'show_completions':
        return `Complete ${value} show${value !== 1 ? 's' : ''}`;
      case 'total_savings':
        return `Save $${value} through optimization`;
      case 'monthly_efficiency':
        return `Achieve $${value}/hour or less efficiency for one month`;
      default:
        return 'Complete the required action';
    }
  };

  const formatUnlockDate = () => {
    if (!userAchievement?.unlocked_at) return null;
    
    const date = new Date(userAchievement.unlocked_at);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getProgressPercentage = () => {
    if (!progress) return 0;
    return Math.min(100, (progress.current_value / progress.target_value) * 100);
  };

  const getRarityLabel = () => {
    if (rarityPercentage === null) return 'Calculating...';
    if (rarityPercentage < 1) return 'Ultra Rare';
    if (rarityPercentage < 5) return 'Very Rare';
    if (rarityPercentage < 15) return 'Rare';
    if (rarityPercentage < 35) return 'Uncommon';
    return 'Common';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { borderColor: tierColors.primary }]}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={28} color="#666" />
          </TouchableOpacity>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Trophy Icon */}
            <View style={[styles.iconContainer, { backgroundColor: tierColors.glow }]}>
              <Ionicons
                name={achievement.icon_name as any}
                size={96}
                color={isUnlocked ? tierColors.primary : '#999'}
                style={!isUnlocked && styles.lockedIcon}
              />
            </View>

            {/* Tier Badge */}
            <View style={[styles.tierBadge, { backgroundColor: tierColors.primary }]}>
              <Text style={styles.tierText}>
                {achievement.tier.toUpperCase()}
              </Text>
            </View>

            {/* Achievement Name */}
            <Text style={styles.achievementName}>{achievement.name}</Text>

            {/* Points */}
            <Text style={[styles.points, { color: tierColors.primary }]}>
              {achievement.points} Points
            </Text>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{achievement.description}</Text>
            </View>

            {/* Unlock Criteria */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How to Unlock</Text>
              <Text style={styles.criteriaText}>{formatUnlockCriteria()}</Text>
            </View>

            {/* Rarity */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rarity</Text>
              <View style={styles.rarityContainer}>
                <Text style={styles.rarityLabel}>{getRarityLabel()}</Text>
                {rarityPercentage !== null && (
                  <Text style={styles.rarityPercentage}>
                    Unlocked by {rarityPercentage}% of users
                  </Text>
                )}
              </View>
            </View>

            {/* Unlock Status */}
            {isUnlocked ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Unlocked</Text>
                <View style={[styles.statusContainer, { backgroundColor: tierColors.glow }]}>
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={tierColors.primary}
                  />
                  <Text style={[styles.unlockDate, { color: tierColors.dark }]}>
                    {formatUnlockDate()}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Progress</Text>
                {progress ? (
                  <>
                    <View style={styles.progressBarContainer}>
                      <View
                        style={[
                          styles.progressBar,
                          {
                            width: `${getProgressPercentage()}%`,
                            backgroundColor: tierColors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {progress.current_value.toFixed(0)} / {progress.target_value.toFixed(0)} (
                      {getProgressPercentage().toFixed(0)}%)
                    </Text>
                  </>
                ) : (
                  <Text style={styles.noProgressText}>Not started yet</Text>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 32,
    alignItems: 'center',
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockedIcon: {
    opacity: 0.4,
  },
  tierBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  tierText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  achievementName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  points: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
  },
  section: {
    width: '100%',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  criteriaText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  rarityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rarityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  rarityPercentage: {
    fontSize: 14,
    color: '#666',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  unlockDate: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 8,
  },
  progressBarContainer: {
    width: '100%',
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  noProgressText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
});
