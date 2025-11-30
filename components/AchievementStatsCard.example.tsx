/**
 * AchievementStatsCard Example
 * 
 * This file demonstrates how to use the AchievementStatsCard component
 * with sample data.
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AchievementStatsCard } from './AchievementStatsCard';
import { AchievementStats } from '../types';
import { Colors } from '../constants/Colors';

// Sample stats data
const sampleStats: AchievementStats = {
  total_unlocked: 12,
  total_available: 26,
  completion_percentage: 46.15,
  total_points: 485,
  by_tier: {
    bronze: { unlocked: 5, total: 8 },
    silver: { unlocked: 4, total: 9 },
    gold: { unlocked: 2, total: 6 },
    platinum: { unlocked: 1, total: 3 },
  },
  recent_achievements: [],
  close_to_unlock: [],
};

// Sample stats for a new user
const newUserStats: AchievementStats = {
  total_unlocked: 2,
  total_available: 26,
  completion_percentage: 7.69,
  total_points: 30,
  by_tier: {
    bronze: { unlocked: 2, total: 8 },
    silver: { unlocked: 0, total: 9 },
    gold: { unlocked: 0, total: 6 },
    platinum: { unlocked: 0, total: 3 },
  },
  recent_achievements: [],
  close_to_unlock: [],
};

// Sample stats for a power user
const powerUserStats: AchievementStats = {
  total_unlocked: 24,
  total_available: 26,
  completion_percentage: 92.31,
  total_points: 3250,
  by_tier: {
    bronze: { unlocked: 8, total: 8 },
    silver: { unlocked: 9, total: 9 },
    gold: { unlocked: 5, total: 6 },
    platinum: { unlocked: 2, total: 3 },
  },
  recent_achievements: [],
  close_to_unlock: [],
};

export default function AchievementStatsCardExample() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <AchievementStatsCard stats={sampleStats} />
      </View>

      <View style={styles.section}>
        <AchievementStatsCard stats={newUserStats} />
      </View>

      <View style={styles.section}>
        <AchievementStatsCard stats={powerUserStats} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
});
