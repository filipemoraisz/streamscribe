/**
 * AchievementUnlockScreen Usage Example
 * 
 * This file demonstrates how to use the AchievementUnlockScreen component
 * to display achievement unlock celebrations.
 */

import React, { useState } from 'react';
import { Button, View } from 'react-native';
import { AchievementUnlockScreen } from './AchievementUnlockScreen';
import type { Achievement, AchievementNotificationPreferences } from '../types';

export const AchievementUnlockExample = () => {
  const [visible, setVisible] = useState(false);

  // Example achievement data
  const exampleAchievement: Achievement = {
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
  };

  // Example notification preferences
  const examplePreferences: AchievementNotificationPreferences = {
    user_id: 'user-123',
    in_app_full_screen: true,
    in_app_banner: true,
    push_notifications: true,
    sound_enabled: true,
    haptic_enabled: true,
    progress_reminders: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const handleShowAchievement = () => {
    setVisible(true);
  };

  const handleClose = () => {
    setVisible(false);
    console.log('Achievement unlock screen closed');
  };

  return (
    <View>
      <Button title="Show Achievement Unlock" onPress={handleShowAchievement} />
      
      <AchievementUnlockScreen
        achievement={exampleAchievement}
        visible={visible}
        onClose={handleClose}
        preferences={examplePreferences}
      />
    </View>
  );
};

/**
 * Integration with Achievement Service
 * 
 * In a real application, you would typically trigger this component
 * when an achievement is unlocked:
 * 
 * ```typescript
 * import { achievementNotificationsService } from '../services/achievementNotifications';
 * 
 * // When an achievement is unlocked
 * const handleAchievementUnlock = async (achievement: Achievement) => {
 *   // Get user preferences
 *   const preferences = await achievementNotificationsService.getNotificationPreferences(userId);
 *   
 *   // Show full-screen unlock for high-tier achievements
 *   if (achievement.tier === 'gold' || achievement.tier === 'platinum') {
 *     setCurrentAchievement(achievement);
 *     setShowUnlockScreen(true);
 *   } else {
 *     // Show banner for lower-tier achievements
 *     await achievementNotificationsService.showUnlockBanner(achievement);
 *   }
 * };
 * ```
 */

/**
 * Features Implemented:
 * 
 * ✓ Full-screen modal with semi-transparent background
 * ✓ Large trophy icon with scale-in bounce animation using react-native-reanimated
 * ✓ Tier-specific background gradient (Bronze, Silver, Gold, Platinum)
 * ✓ Confetti/particle animation system (50 particles with physics)
 * ✓ Achievement name with typewriter effect
 * ✓ Description with fade-in animation
 * ✓ Points counter with animated counting
 * ✓ Glow/shine effects around trophy (dual-layer glow)
 * ✓ Sound effect playback using expo-av (optional based on preferences)
 * ✓ Haptic feedback using expo-haptics (optional based on preferences)
 * ✓ "Tap to continue" prompt with pulse animation
 * ✓ Share button functionality
 * ✓ Animation sequence with precise timing:
 *   - Background fade: 0-200ms
 *   - Trophy scale-in: 200-800ms
 *   - Confetti burst: 500ms
 *   - Name typewriter: 800-1200ms
 *   - Description fade: 1200-1500ms
 *   - Points counter: 1500-2000ms
 *   - Continue prompt: 2000ms+
 * 
 * Tier-specific Features:
 * - Bronze: Light haptic, bronze gradient, copper colors
 * - Silver: Medium haptic, silver gradient, metallic gray colors
 * - Gold: Heavy haptic, gold gradient, golden yellow colors
 * - Platinum: Success haptic, platinum gradient, white metallic colors
 */
