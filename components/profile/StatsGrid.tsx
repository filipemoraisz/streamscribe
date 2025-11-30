import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/Colors';
import { UserStats } from '../../types';

interface StatsGridProps {
  stats: UserStats;
  loading?: boolean;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats, loading = false }) => {
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.grid}>
          <SkeletonStreakCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        <StreakCard currentStreak={stats.currentStreak} longestStreak={stats.longestStreak} />
        <EpisodesCard totalEpisodes={stats.totalEpisodes} />
        <ShowsCard showsCompleted={stats.showsCompleted} />
        <PointsCard achievementPoints={stats.achievementPoints} />
      </View>
    </View>
  );
};

// ============================================
// Skeleton Components
// ============================================

const SkeletonStreakCard: React.FC = () => {
  const shimmerAnim = useSharedValue(0);

  useEffect(() => {
    shimmerAnim.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmerAnim.value * 0.3,
  }));

  return (
    <View style={[styles.card, styles.skeletonCard]}>
      <LinearGradient
        colors={['#2A2A2A', '#3A3A3A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.streakGradient}
      >
        <Animated.View style={[styles.skeletonIconCircle, shimmerStyle]} />
        <Animated.View style={[styles.skeletonValueLarge, shimmerStyle]} />
        <Animated.View style={[styles.skeletonLabel, shimmerStyle]} />
        <Animated.View style={[styles.skeletonLabelSmall, shimmerStyle]} />
      </LinearGradient>
    </View>
  );
};

const SkeletonStatCard: React.FC = () => {
  const shimmerAnim = useSharedValue(0);

  useEffect(() => {
    shimmerAnim.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmerAnim.value * 0.3,
  }));

  return (
    <View style={[styles.card, styles.statCard, styles.skeletonCard]}>
      <Animated.View style={[styles.skeletonIconCircle, shimmerStyle]} />
      <Animated.View style={[styles.skeletonValueLarge, { marginTop: 8 }, shimmerStyle]} />
      <Animated.View style={[styles.skeletonLabel, { marginTop: 4 }, shimmerStyle]} />
    </View>
  );
};

// ============================================
// StreakCard Component
// ============================================

interface StreakCardProps {
  currentStreak: number;
  longestStreak: number;
}

const StreakCard: React.FC<StreakCardProps> = ({ currentStreak, longestStreak }) => {
  const fadeAnim = useSharedValue(0);
  const flameScale = useSharedValue(1);

  useEffect(() => {
    // Fade in animation
    fadeAnim.value = withDelay(
      0,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
    );

    // Flame flicker animation
    if (currentStreak > 0) {
      flameScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 300 }),
          withTiming(0.95, { duration: 300 }),
          withTiming(1, { duration: 300 })
        ),
        -1, // Infinite
        false
      );
    }
  }, [currentStreak]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: fadeAnim.value }],
  }));

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameScale.value }],
  }));

  return (
    <Animated.View style={[styles.card, fadeStyle]}>
      <LinearGradient
        colors={['#FF6600', '#FF8833']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.streakGradient}
      >
        <Animated.View style={flameStyle}>
          <Ionicons name="flame" size={32} color="#FFFFFF" />
        </Animated.View>
        <Text style={styles.streakValue}>{currentStreak}</Text>
        <Text style={styles.streakLabel}>Day Streak</Text>
        {longestStreak > 0 && (
          <Text style={styles.streakSecondary}>Best: {longestStreak}</Text>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

// ============================================
// EpisodesCard Component
// ============================================

interface EpisodesCardProps {
  totalEpisodes: number;
}

const EpisodesCard: React.FC<EpisodesCardProps> = ({ totalEpisodes }) => {
  const fadeAnim = useSharedValue(0);
  const counterAnim = useSharedValue(0);

  useEffect(() => {
    // Fade in animation
    fadeAnim.value = withDelay(
      100,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
    );

    // Counter animation
    counterAnim.value = withDelay(
      200,
      withTiming(totalEpisodes, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );
  }, [totalEpisodes]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: fadeAnim.value }],
  }));

  const counterStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  return (
    <Animated.View style={[styles.card, styles.statCard, fadeStyle]}>
      <View style={styles.iconContainer}>
        <Ionicons name="play-circle" size={32} color={Colors.primary} />
      </View>
      <Animated.Text style={[styles.statValue, counterStyle]}>
        {Math.round(totalEpisodes)}
      </Animated.Text>
      <Text style={styles.statLabel}>Episodes</Text>
    </Animated.View>
  );
};

// ============================================
// ShowsCard Component
// ============================================

interface ShowsCardProps {
  showsCompleted: number;
}

const ShowsCard: React.FC<ShowsCardProps> = ({ showsCompleted }) => {
  const fadeAnim = useSharedValue(0);
  const counterAnim = useSharedValue(0);

  useEffect(() => {
    // Fade in animation
    fadeAnim.value = withDelay(
      200,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
    );

    // Counter animation
    counterAnim.value = withDelay(
      300,
      withTiming(showsCompleted, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );
  }, [showsCompleted]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: fadeAnim.value }],
  }));

  const counterStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  return (
    <Animated.View style={[styles.card, styles.statCard, fadeStyle]}>
      <View style={styles.iconContainer}>
        <Ionicons name="tv" size={32} color={Colors.primary} />
      </View>
      <Animated.Text style={[styles.statValue, counterStyle]}>
        {Math.round(showsCompleted)}
      </Animated.Text>
      <Text style={styles.statLabel}>Shows Done</Text>
    </Animated.View>
  );
};

// ============================================
// PointsCard Component
// ============================================

interface PointsCardProps {
  achievementPoints: number;
}

const PointsCard: React.FC<PointsCardProps> = ({ achievementPoints }) => {
  const fadeAnim = useSharedValue(0);
  const counterAnim = useSharedValue(0);

  useEffect(() => {
    // Fade in animation
    fadeAnim.value = withDelay(
      300,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
    );

    // Counter animation
    counterAnim.value = withDelay(
      400,
      withTiming(achievementPoints, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );
  }, [achievementPoints]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: fadeAnim.value }],
  }));

  const counterStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  return (
    <Animated.View style={[styles.card, styles.statCard, fadeStyle]}>
      <View style={styles.iconContainer}>
        <Ionicons name="star" size={32} color={Colors.primary} />
      </View>
      <Animated.Text style={[styles.statValue, counterStyle]}>
        {Math.round(achievementPoints)}
      </Animated.Text>
      <Text style={styles.statLabel}>Points</Text>
    </Animated.View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    marginBottom: 8,
  },
  streakValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  streakLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 4,
  },
  streakSecondary: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.7,
    marginTop: 4,
  },
  statValue: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  skeletonCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skeletonIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.border,
    marginBottom: 8,
  },
  skeletonValueLarge: {
    width: 60,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.border,
    marginTop: 8,
  },
  skeletonLabel: {
    width: 80,
    height: 14,
    borderRadius: 4,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
  skeletonLabelSmall: {
    width: 60,
    height: 12,
    borderRadius: 4,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
});
