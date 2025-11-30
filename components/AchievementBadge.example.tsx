/**
 * AchievementBadge Component Examples
 * 
 * This component displays a badge showing the user's achievement progress
 * and provides a quick link to the achievements screen.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AchievementBadge } from './AchievementBadge';

// Example 1: Default (Medium) Size
export function DefaultBadgeExample() {
  return (
    <View style={styles.container}>
      <AchievementBadge />
    </View>
  );
}

// Example 2: Small Size
export function SmallBadgeExample() {
  return (
    <View style={styles.container}>
      <AchievementBadge size="small" />
    </View>
  );
}

// Example 3: Large Size (Used in Profile)
export function LargeBadgeExample() {
  return (
    <View style={styles.container}>
      <AchievementBadge size="large" />
    </View>
  );
}

// Example 4: Custom onPress Handler
export function CustomHandlerExample() {
  const handlePress = () => {
    console.log('Custom achievement badge pressed!');
    // Custom navigation or action
  };

  return (
    <View style={styles.container}>
      <AchievementBadge onPress={handlePress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
});
