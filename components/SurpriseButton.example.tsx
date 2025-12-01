/**
 * SurpriseButton Component Example
 * 
 * A prominent button that triggers random content selection with engaging animations
 * and haptic feedback.
 * 
 * Features:
 * - Engaging design with primary brand color
 * - Loading state with spinner during random selection
 * - Haptic feedback on press (Medium impact)
 * - Animated press effect (scale down/up)
 * - Animated icon rotation when idle
 * - Disabled state during loading
 * 
 * Requirements: 8.1, 8.5
 */

import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SurpriseButton } from './SurpriseButton';
import { router } from 'expo-router';

export default function SurpriseButtonExample() {
  const [loading, setLoading] = useState(false);

  const handleSurpriseMe = async () => {
    setLoading(true);

    // Simulate random selection process
    setTimeout(() => {
      setLoading(false);
      
      // Navigate to a random item (example)
      // In real implementation, this would select from taste profile recommendations
      // or trending content as fallback
      Alert.alert('Surprise!', 'Navigating to random content...');
      
      // Example navigation:
      // router.push(`/details/movie/12345`);
    }, 1500);
  };

  return (
    <View style={styles.container}>
      <SurpriseButton
        onPress={handleSurpriseMe}
        loading={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
});

/**
 * Usage in Home Screen:
 * 
 * ```tsx
 * import { SurpriseButton } from '@/components';
 * import { tasteProfileService } from '@/services/tasteProfileService';
 * import { tmdbService } from '@/services/tmdb';
 * 
 * const [surpriseLoading, setSurpriseLoading] = useState(false);
 * 
 * const handleSurpriseMe = async () => {
 *   setSurpriseLoading(true);
 *   
 *   try {
 *     // Get user's taste profile
 *     const profile = await tasteProfileService.buildTasteProfile(userId);
 *     
 *     // Get recommendations
 *     const recommendations = await tasteProfileService.generateTasteRecommendations(
 *       profile,
 *       subscribedServices,
 *       new Set(watchlist.map(w => `${w.type}-${w.id}`)),
 *       20
 *     );
 *     
 *     // Select random item
 *     let randomItem;
 *     if (recommendations.length > 0) {
 *       randomItem = recommendations[Math.floor(Math.random() * recommendations.length)];
 *     } else {
 *       // Fallback to trending content
 *       const trending = await tmdbService.getTrendingMovies();
 *       randomItem = trending[Math.floor(Math.random() * trending.length)];
 *       randomItem = { ...randomItem, type: 'movie' };
 *     }
 *     
 *     // Navigate to detail screen
 *     router.push(`/details/${randomItem.type}/${randomItem.id}`);
 *   } catch (error) {
 *     console.error('Error in Surprise Me:', error);
 *     Alert.alert('Error', 'Failed to find a surprise. Please try again.');
 *   } finally {
 *     setSurpriseLoading(false);
 *   }
 * };
 * 
 * <SurpriseButton
 *   onPress={handleSurpriseMe}
 *   loading={surpriseLoading}
 * />
 * ```
 */
