/**
 * Example: Integrating AchievementShowcase into Profile Screen
 * 
 * This example shows how to add the AchievementShowcase component
 * to the profile screen between StatsGrid and QuickActionsGrid.
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { AchievementShowcase } from './AchievementShowcase';
import { StatsGrid } from './StatsGrid';
import { QuickActionsGrid } from './QuickActionsGrid';
import { Colors } from '../../constants/Colors';

interface ProfileScreenExampleProps {
  userId: string;
  userStats: any; // UserStats type
}

export const ProfileScreenExample: React.FC<ProfileScreenExampleProps> = ({ 
  userId, 
  userStats 
}) => {
  return (
    <ScrollView style={styles.container}>
      {/* Profile Header would go here */}
      
      {/* Stats Grid */}
      <StatsGrid stats={userStats} />

      {/* Achievement Showcase - NEW SECTION */}
      <AchievementShowcase 
        userId={userId}
        onRefresh={() => {
          console.log('Achievements refreshed');
        }}
      />

      {/* Quick Actions Grid */}
      <QuickActionsGrid />

      {/* Personal Information would go here */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});

/**
 * Expected Layout Order:
 * 
 * 1. Profile Header (avatar, name, email)
 * 2. StatsGrid (streak, episodes, shows, points)
 * 3. AchievementShowcase (NEW)
 *    - AchievementStatsCard (circular progress, tier breakdown)
 *    - FeaturedAchievements (horizontal scroll of recent/close achievements)
 * 4. QuickActionsGrid (notification settings, etc.)
 * 5. Personal Information (name, email, member since)
 */

/**
 * Visual Structure:
 * 
 * ┌─────────────────────────────────────┐
 * │         Profile Header              │
 * │    (Avatar with orange glow)        │
 * └─────────────────────────────────────┘
 * 
 * ┌──────────────┬──────────────┐
 * │   Streak     │   Episodes   │
 * │   Card       │   Card       │
 * ├──────────────┼──────────────┤
 * │   Shows      │   Points     │
 * │   Card       │   Card       │
 * └──────────────┴──────────────┘
 * 
 * ┌─────────────────────────────────────┐
 * │   Achievement Progress              │
 * │   ┌─────┐  Stats Summary            │
 * │   │ 75% │  Unlocked: 12             │
 * │   └─────┘  Total: 20                │
 * │            Points: 450               │
 * │                                      │
 * │   By Tier:                           │
 * │   Bronze ████████░░ 8/10             │
 * │   Silver ████░░░░░░ 4/10             │
 * │   Gold   ░░░░░░░░░░ 0/10             │
 * │   Platinum ░░░░░░░░ 0/10             │
 * └─────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────┐
 * │   Featured Achievements             │
 * │   ┌────┐  ┌────┐  ┌────┐           │
 * │   │ 🏆 │  │ 🔥 │  │ ⭐ │  →        │
 * │   │100%│  │ 85%│  │ 90%│           │
 * │   └────┘  └────┘  └────┘           │
 * └─────────────────────────────────────┘
 * 
 * ┌──────────────┬──────────────┐
 * │ Notifications│ Achievements │
 * ├──────────────┼──────────────┤
 * │ Connection   │ History      │
 * └──────────────┴──────────────┘
 */
