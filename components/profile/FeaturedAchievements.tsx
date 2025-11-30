import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator } from 'react-native';
import { FeaturedAchievementCard } from './FeaturedAchievementCard';
import AchievementDetailModal from '../AchievementDetailModal';
import { Colors } from '../../constants/Colors';
import { Achievement, AchievementProgress, UserAchievement } from '../../types';
import { achievementsService } from '../../services/achievements';

interface FeaturedAchievementsProps {
  userId: string;
}

export const FeaturedAchievements: React.FC<FeaturedAchievementsProps> = ({ userId }) => {
  const [recentUnlocks, setRecentUnlocks] = useState<UserAchievement[]>([]);
  const [closeToUnlock, setCloseToUnlock] = useState<AchievementProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [selectedUserAchievement, setSelectedUserAchievement] = useState<UserAchievement | undefined>(undefined);
  const [selectedProgress, setSelectedProgress] = useState<AchievementProgress | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadFeaturedAchievements();
  }, [userId]);

  const loadFeaturedAchievements = async () => {
    try {
      setLoading(true);
      
      // Get achievement stats which includes recent and close to unlock
      const stats = await achievementsService.getAchievementStats(userId);
      
      // Get last 3 recent unlocks
      setRecentUnlocks(stats.recent_achievements.slice(0, 3));
      
      // Get achievements close to unlock (>75% progress)
      setCloseToUnlock(stats.close_to_unlock.slice(0, 3));
    } catch (error) {
      console.error('Error loading featured achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAchievementPress = (
    achievement: Achievement,
    userAchievement?: UserAchievement,
    progress?: AchievementProgress
  ) => {
    setSelectedAchievement(achievement);
    setSelectedUserAchievement(userAchievement);
    setSelectedProgress(progress);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedAchievement(null);
    setSelectedUserAchievement(undefined);
    setSelectedProgress(undefined);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      </View>
    );
  }

  // Combine recent unlocks and close to unlock for display
  const featuredItems = [
    ...recentUnlocks.map(ua => ({
      achievement: ua.achievement!,
      userAchievement: ua,
      progress: undefined,
      type: 'unlocked' as const
    })),
    ...closeToUnlock.map(p => ({
      achievement: p.achievement!,
      userAchievement: undefined,
      progress: p,
      type: 'progress' as const
    }))
  ];

  if (featuredItems.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="star" size={20} color={Colors.primary} />
          <Text style={styles.headerTitle}>Featured Achievements</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Start watching to unlock achievements!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="star" size={20} color={Colors.primary} />
        <Text style={styles.headerTitle}>Featured Achievements</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={172} // Card width (160) + margin (12)
        decelerationRate="fast"
        snapToAlignment="start"
      >
        {featuredItems.map((item, index) => (
          <FeaturedAchievementCard
            key={`${item.achievement.id}-${index}`}
            achievement={item.achievement}
            userAchievement={item.userAchievement}
            progress={item.progress}
            onPress={() => handleAchievementPress(
              item.achievement,
              item.userAchievement,
              item.progress
            )}
          />
        ))}
      </ScrollView>

      {/* Achievement Detail Modal */}
      {selectedAchievement && (
        <AchievementDetailModal
          visible={modalVisible}
          achievement={selectedAchievement}
          userAchievement={selectedUserAchievement}
          progress={selectedProgress}
          onClose={handleCloseModal}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
