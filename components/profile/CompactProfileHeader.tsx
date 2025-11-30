import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { UserStats } from '../../types';

interface CompactProfileHeaderProps {
  userName: string;
  userEmail: string;
  stats: UserStats;
  onEditPress?: () => void;
}

export const CompactProfileHeader: React.FC<CompactProfileHeaderProps> = ({
  userName,
  userEmail,
  stats,
  onEditPress,
}) => {
  const fadeAnim = useSharedValue(0);
  const flameScale = useSharedValue(1);

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });

    // Flame flicker animation for streak
    if (stats.currentStreak > 0) {
      flameScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 300 }),
          withTiming(0.95, { duration: 300 }),
          withTiming(1, { duration: 300 })
        ),
        -1,
        false
      );
    }
  }, [stats.currentStreak]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, fadeStyle]}>
      {/* Top Section: Avatar, User Info, and Edit Icon */}
      <View style={styles.topSection}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>{userName}</Text>
          <Text style={styles.userEmail} numberOfLines={1}>{userEmail}</Text>
        </View>
        {onEditPress && (
          <TouchableOpacity onPress={onEditPress} style={styles.editIcon}>
            <Ionicons name="pencil" size={16} color="#ff8a4c" />
          </TouchableOpacity>
        )}
      </View>

      {/* Right Side: Compact Stats */}
      <View style={styles.statsRow}>
        {/* Streak */}
        <View style={styles.statItem}>
          <LinearGradient
            colors={['#ff8a4c', '#ffb088']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.streakBadge}
          >
            <Animated.View style={flameStyle}>
              <Ionicons name="flame" size={16} color="#FFFFFF" />
            </Animated.View>
          </LinearGradient>
          <Text style={styles.statValue}>{stats.currentStreak}</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>

        {/* Episodes */}
        <View style={styles.statItem}>
          <View style={styles.iconBadge}>
            <Ionicons name="play-circle" size={16} color="#ff8a4c" />
          </View>
          <Text style={styles.statValue}>{stats.totalEpisodes}</Text>
          <Text style={styles.statLabel}>Episodes</Text>
        </View>

        {/* Shows */}
        <View style={styles.statItem}>
          <View style={styles.iconBadge}>
            <Ionicons name="tv" size={16} color="#ff8a4c" />
          </View>
          <Text style={styles.statValue}>{stats.showsCompleted}</Text>
          <Text style={styles.statLabel}>Shows</Text>
        </View>

        {/* Points */}
        <View style={styles.statItem}>
          <View style={styles.iconBadge}>
            <Ionicons name="star" size={16} color="#ffb088" />
          </View>
          <Text style={styles.statValue}>{stats.achievementPoints}</Text>
          <Text style={styles.statLabel}>Points</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a0f0a',
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 76, 0.25)',
    shadowColor: '#ff8a4c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2a1a10',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ff8a4c',
    marginRight: 12,
    shadowColor: '#ff8a4c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff8a4c',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8f8f2',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  editIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 138, 76, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 76, 0.3)',
    alignSelf: 'center',
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255, 138, 76, 0.6)',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 138, 76, 0.15)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  streakBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    shadowColor: '#ff8a4c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 138, 76, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 76, 0.25)',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8f8f2',
    marginTop: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 138, 76, 0.6)',
    marginTop: 2,
    letterSpacing: 0.3,
  },
});
