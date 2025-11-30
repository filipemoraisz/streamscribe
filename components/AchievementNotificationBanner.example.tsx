/**
 * AchievementNotificationBanner Example Usage
 * 
 * This file demonstrates how to use the AchievementNotificationBanner component
 * and the useAchievementNotificationBanner hook for queue management.
 */

import React, { useState } from 'react';
import { View, Button, StyleSheet } from 'react-native';
import { AchievementNotificationBanner, useAchievementNotificationBanner } from './AchievementNotificationBanner';
import { AchievementUnlockScreen } from './AchievementUnlockScreen';
import { Achievement } from '../types';

// Example achievements for testing
const exampleAchievements: Achievement[] = [
  {
    id: '1',
    achievement_key: 'first_steps',
    name: 'First Steps',
    description: 'Watch your first episode',
    category: 'viewing',
    tier: 'bronze',
    icon_name: 'trophy-outline',
    icon_library: 'Ionicons',
    unlock_criteria: { type: 'episode_count', value: 1 },
    points: 10,
    sort_order: 1,
  },
  {
    id: '2',
    achievement_key: 'binge_watcher',
    name: 'Binge Watcher',
    description: 'Watch 50 episodes',
    category: 'viewing',
    tier: 'silver',
    icon_name: 'trophy',
    icon_library: 'Ionicons',
    unlock_criteria: { type: 'episode_count', value: 50 },
    points: 50,
    sort_order: 3,
  },
  {
    id: '3',
    achievement_key: 'tv_connoisseur',
    name: 'TV Connoisseur',
    description: 'Watch 250 episodes',
    category: 'viewing',
    tier: 'gold',
    icon_name: 'trophy',
    icon_library: 'Ionicons',
    unlock_criteria: { type: 'episode_count', value: 250 },
    points: 200,
    sort_order: 5,
  },
  {
    id: '4',
    achievement_key: 'legendary_viewer',
    name: 'Legendary Viewer',
    description: 'Watch 1000 episodes',
    category: 'viewing',
    tier: 'platinum',
    icon_name: 'trophy',
    icon_library: 'Ionicons',
    unlock_criteria: { type: 'episode_count', value: 1000 },
    points: 500,
    sort_order: 7,
  },
];

export const AchievementNotificationBannerExample: React.FC = () => {
  const {
    currentAchievement,
    isVisible,
    showNotification,
    dismissNotification,
    expandToFullScreen,
    clearQueue,
    queueLength,
  } = useAchievementNotificationBanner();

  const [showFullScreen, setShowFullScreen] = useState(false);
  const [fullScreenAchievement, setFullScreenAchievement] = useState<Achievement | null>(null);

  const handleShowBanner = (achievement: Achievement) => {
    showNotification(achievement);
  };

  const handleExpandToFullScreen = () => {
    if (currentAchievement) {
      setFullScreenAchievement(currentAchievement);
      setShowFullScreen(true);
      expandToFullScreen();
    }
  };

  const handleCloseFullScreen = () => {
    setShowFullScreen(false);
    setFullScreenAchievement(null);
  };

  return (
    <View style={styles.container}>
      {/* Banner Component */}
      <AchievementNotificationBanner
        achievement={currentAchievement}
        visible={isVisible}
        onDismiss={dismissNotification}
        onPress={handleExpandToFullScreen}
      />

      {/* Full Screen Unlock Modal */}
      {fullScreenAchievement && (
        <AchievementUnlockScreen
          achievement={fullScreenAchievement}
          visible={showFullScreen}
          onClose={handleCloseFullScreen}
        />
      )}

      {/* Test Controls */}
      <View style={styles.controls}>
        <Button
          title="Show Bronze Achievement"
          onPress={() => handleShowBanner(exampleAchievements[0])}
        />
        <Button
          title="Show Silver Achievement"
          onPress={() => handleShowBanner(exampleAchievements[1])}
        />
        <Button
          title="Show Gold Achievement"
          onPress={() => handleShowBanner(exampleAchievements[2])}
        />
        <Button
          title="Show Platinum Achievement"
          onPress={() => handleShowBanner(exampleAchievements[3])}
        />
        <Button
          title="Show Multiple (Queue Test)"
          onPress={() => {
            exampleAchievements.forEach((achievement, index) => {
              setTimeout(() => handleShowBanner(achievement), index * 100);
            });
          }}
        />
        <Button
          title={`Clear Queue (${queueLength} pending)`}
          onPress={clearQueue}
          disabled={queueLength === 0}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  controls: {
    gap: 10,
    width: '100%',
    maxWidth: 300,
  },
});

/**
 * Usage in a real application:
 * 
 * 1. Import the hook and component:
 *    import { useAchievementNotificationBanner, AchievementNotificationBanner } from './components';
 * 
 * 2. Use the hook in your root component or achievement context:
 *    const { currentAchievement, isVisible, showNotification, dismissNotification, expandToFullScreen } = useAchievementNotificationBanner();
 * 
 * 3. Render the banner component:
 *    <AchievementNotificationBanner
 *      achievement={currentAchievement}
 *      visible={isVisible}
 *      onDismiss={dismissNotification}
 *      onPress={handleExpandToFullScreen}
 *    />
 * 
 * 4. When an achievement is unlocked, call:
 *    showNotification(achievement);
 * 
 * 5. Handle expansion to full screen:
 *    const handleExpandToFullScreen = () => {
 *      if (currentAchievement) {
 *        setFullScreenAchievement(currentAchievement);
 *        setShowFullScreen(true);
 *        expandToFullScreen();
 *      }
 *    };
 * 
 * Features:
 * - Auto-dismisses after 5 seconds
 * - Swipe up to dismiss manually
 * - Tap to expand to full unlock screen
 * - Queue support for multiple achievements
 * - Tier-specific styling (bronze, silver, gold, platinum)
 * - Smooth animations with spring physics
 */
