import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { contextualMessagingService } from '../services/contextualMessaging';

interface AtAGlanceStats {
  currentStreak: number;
  totalEpisodes: number;
  totalSavings: number;
}

interface AtAGlanceHeroProps {
  stats: AtAGlanceStats;
  loading?: boolean;
  onPress?: () => void;
  onShowRecommendations?: (genreIds: number[], mood: string) => void;
}

export function AtAGlanceHero({ stats, loading = false, onPress, onShowRecommendations }: AtAGlanceHeroProps) {
  // Animation values
  const containerOpacity = useSharedValue(0);
  const containerTranslateY = useSharedValue(20);
  const icon1Scale = useSharedValue(0);
  const icon2Scale = useSharedValue(0);
  const icon3Scale = useSharedValue(0);
  const pressScale = useSharedValue(1);

  // Animated counter values
  const streakValue = useSharedValue(0);
  const episodesValue = useSharedValue(0);
  const savingsValue = useSharedValue(0);

  useEffect(() => {
    // Container entrance
    containerOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
    containerTranslateY.value = withSpring(0, { damping: 15, stiffness: 100 });

    // Staggered icon animations
    icon1Scale.value = withDelay(100, withSpring(1, { damping: 12, stiffness: 150 }));
    icon2Scale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 150 }));
    icon3Scale.value = withDelay(300, withSpring(1, { damping: 12, stiffness: 150 }));

    // Counter animations
    streakValue.value = withTiming(stats.currentStreak, { duration: 800, easing: Easing.out(Easing.cubic) });
    episodesValue.value = withTiming(stats.totalEpisodes, { duration: 800, easing: Easing.out(Easing.cubic) });
    savingsValue.value = withTiming(stats.totalSavings, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [stats]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [
      { translateY: containerTranslateY.value },
      { scale: pressScale.value },
    ],
  }));

  const icon1AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: icon1Scale.value }],
  }));

  const icon2AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: icon2Scale.value }],
  }));

  const icon3AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: icon3Scale.value }],
  }));

  const handlePressIn = () => {
    pressScale.value = withTiming(0.98, { duration: 150 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 10, stiffness: 200 });
  };

  // Get contextual message and data based on time, day, season, and streak
  const contextualData = useMemo(() => {
    // Check if there's a special streak milestone message
    const streakMessage = contextualMessagingService.getStreakMessage(stats.currentStreak);
    if (streakMessage) {
      return streakMessage;
    }

    // Otherwise, get contextual message based on time/day/season
    return contextualMessagingService.getContextualMessage(stats.currentStreak);
  }, [stats.currentStreak]);

  const handleRecommendationsPress = () => {
    if (onShowRecommendations && contextualData.suggestedGenres && contextualData.suggestedMood) {
      onShowRecommendations(contextualData.suggestedGenres, contextualData.suggestedMood);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0A0A0A', '#111111']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading your stats...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.container}
    >
      <Animated.View style={containerAnimatedStyle}>
        <LinearGradient
          colors={['#0A0A0A', '#111111']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerText}>✨ Your Journey</Text>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {/* Streak */}
            <View style={styles.statCard}>
              <LinearGradient
                colors={['rgba(128, 128, 128, 0.15)', 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.statGradient}
              >
                <View style={styles.statCardInner}>
                  <Animated.View style={icon1AnimatedStyle}>
                    <Ionicons name="flame" size={22} color="#FF5C00" />
                  </Animated.View>
                  <Text style={styles.statValue}>{stats.currentStreak}</Text>
                  <Text style={styles.statLabel}>
                    {stats.currentStreak === 1 ? 'DAY STREAK' : 'DAY STREAK'}
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {/* Episodes */}
            <View style={styles.statCard}>
              <LinearGradient
                colors={['rgba(128, 128, 128, 0.15)', 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.statGradient}
              >
                <View style={styles.statCardInner}>
                  <Animated.View style={icon2AnimatedStyle}>
                    <Ionicons name="tv" size={22} color="#FF5C00" />
                  </Animated.View>
                  <Text style={styles.statValue}>{stats.totalEpisodes}</Text>
                  <Text style={styles.statLabel}>
                    {stats.totalEpisodes === 1 ? 'EPISODE WATCHED' : 'EPISODES WATCHED'}
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {/* Total Savings */}
            <View style={styles.statCard}>
              <LinearGradient
                colors={['rgba(128, 128, 128, 0.15)', 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.statGradient}
              >
                <View style={styles.statCardInner}>
                  <Animated.View style={icon3AnimatedStyle}>
                    <Ionicons name="wallet" size={22} color="#10B981" />
                  </Animated.View>
                  <Text style={[styles.statValue, styles.savingsValue]}>
                    ${stats.totalSavings >= 1000 
                      ? `${Math.round(stats.totalSavings / 1000)}k` 
                      : Math.round(stats.totalSavings)}
                  </Text>
                  <Text style={styles.statLabel}>SAVED</Text>
                </View>
              </LinearGradient>
            </View>
          </View>

          {/* Footer Message & Button */}
          <View style={styles.footer}>
            <View style={styles.messageRow}>
              <Text style={styles.footerText}>{contextualData.message}</Text>
              
              {contextualData.suggestedGenres && contextualData.suggestedGenres.length > 0 && (
                <TouchableOpacity 
                  onPress={handleRecommendationsPress}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.recommendButtonText}>Show Me →</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 30,
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  gradient: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 92, 0, 0.4)',
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    marginBottom: 20,
  },
  headerText: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 92, 0, 0.95)',
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statGradient: {
    borderRadius: 12,
  },
  statCardInner: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    height: 24,
    lineHeight: 12,
  },
  savingsValue: {
    color: '#10B981',
  },
  footer: {
    marginTop: 8,
    alignItems: 'center',
  },
  messageRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.2,
  },
  recommendButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF5C00',
    letterSpacing: 0.3,
  },
  loadingContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
