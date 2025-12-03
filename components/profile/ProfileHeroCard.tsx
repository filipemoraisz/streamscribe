import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileColors } from '../../constants/ProfileColors';
import { UserStats } from '../../types';

interface ProfileHeroCardProps {
  userName: string;
  userEmail: string;
  stats: UserStats;
  onEditPress?: () => void;
  profileImage?: string | null;
}

export const ProfileHeroCard: React.FC<ProfileHeroCardProps> = ({
  userName,
  userEmail,
  stats,
  onEditPress,
  profileImage,
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
      <LinearGradient
        colors={['#0A0A0A', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <LinearGradient
                colors={[ProfileColors.primary, ProfileColors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            )}
          </View>
          
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{userName}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{userEmail}</Text>
          </View>

          {onEditPress && (
            <TouchableOpacity onPress={onEditPress} style={styles.editButton}>
              <Ionicons name="pencil" size={18} color={ProfileColors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          {/* Streak */}
          <View style={styles.statItem}>
            <LinearGradient
              colors={[ProfileColors.primary, ProfileColors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statIconContainer}
            >
              <Animated.View style={flameStyle}>
                <Ionicons name="flame" size={20} color="#FFFFFF" />
              </Animated.View>
            </LinearGradient>
            <Text style={styles.statValue}>{stats.currentStreak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>

          {/* Episodes */}
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Ionicons name="play-circle" size={20} color={ProfileColors.primary} />
            </View>
            <Text style={styles.statValue}>{stats.totalEpisodes}</Text>
            <Text style={styles.statLabel}>Episodes</Text>
          </View>

          {/* Shows */}
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Ionicons name="tv" size={20} color={ProfileColors.primary} />
            </View>
            <Text style={styles.statValue}>{stats.showsCompleted}</Text>
            <Text style={styles.statLabel}>Shows</Text>
          </View>

          {/* Points */}
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Ionicons name="star" size={20} color={ProfileColors.warning} />
            </View>
            <Text style={styles.statValue}>{stats.achievementPoints}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 102, 0, 0.3)',
  },
  gradient: {
    padding: 20,
    backgroundColor: '#0A0A0A',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 102, 0, 0.2)',
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 16,
  },
  avatarGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: ProfileColors.primary,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: ProfileColors.text,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: ProfileColors.textSecondary,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 102, 0, 0.3)',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: ProfileColors.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: ProfileColors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.3,
  },
});
