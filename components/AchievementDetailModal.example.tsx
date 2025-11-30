import React, { useState } from 'react';
import { View, Button, StyleSheet } from 'react-native';
import AchievementDetailModal from './AchievementDetailModal';
import { Achievement, UserAchievement, AchievementProgress } from '../types';

/**
 * Example usage of AchievementDetailModal component
 */
export default function AchievementDetailModalExample() {
  const [modalVisible, setModalVisible] = useState(false);

  // Example unlocked achievement
  const unlockedAchievement: Achievement = {
    id: '1',
    achievement_key: 'binge_watcher',
    name: 'Binge Watcher',
    description: 'Watch 50 episodes and prove your dedication to great storytelling',
    category: 'viewing',
    tier: 'silver',
    icon_name: 'trophy',
    icon_library: 'Ionicons',
    unlock_criteria: {
      type: 'episode_count',
      value: 50,
    },
    points: 50,
    sort_order: 3,
  };

  const userAchievement: UserAchievement = {
    id: 'ua1',
    user_id: 'user123',
    achievement_id: '1',
    achievement: unlockedAchievement,
    unlocked_at: '2024-01-15T10:30:00Z',
    notified: true,
  };

  // Example locked achievement with progress
  const lockedAchievement: Achievement = {
    id: '2',
    achievement_key: 'marathon_master',
    name: 'Marathon Master',
    description: 'Watch 500 episodes and become a true viewing champion',
    category: 'viewing',
    tier: 'gold',
    icon_name: 'trophy',
    icon_library: 'Ionicons',
    unlock_criteria: {
      type: 'episode_count',
      value: 500,
    },
    points: 300,
    sort_order: 6,
  };

  const achievementProgress: AchievementProgress = {
    id: 'ap1',
    user_id: 'user123',
    achievement_id: '2',
    achievement: lockedAchievement,
    current_value: 325,
    target_value: 500,
    last_updated: '2024-01-20T15:45:00Z',
    progress_percentage: 65,
  };

  return (
    <View style={styles.container}>
      <Button
        title="Show Unlocked Achievement"
        onPress={() => setModalVisible(true)}
      />

      <AchievementDetailModal
        achievement={unlockedAchievement}
        userAchievement={userAchievement}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />

      {/* Example with locked achievement and progress */}
      {/* 
      <AchievementDetailModal
        achievement={lockedAchievement}
        progress={achievementProgress}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});
