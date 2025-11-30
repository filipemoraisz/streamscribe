import { BlurView } from 'expo-blur';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import React, { useState, useCallback, useEffect } from 'react';
import {
  Alert,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
  ActivityIndicator
} from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '../../components/Logo';
import { CompactProfileHeader } from '../../components/profile/CompactProfileHeader';
import { QuickActionsGrid, QuickAction } from '../../components/profile/QuickActionsGrid';
import { FeaturedAchievements } from '../../components/profile/FeaturedAchievements';
import { AchievementStatsCard } from '../../components/AchievementStatsCard';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { userActivityService } from '../../services/userActivity';
import { achievementsService } from '../../services/achievements';
import { UserStats, AchievementStats } from '../../types';

const HEADER_HEIGHT = 60;

export default function ProfileScreen() {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [refreshing, setRefreshing] = useState(false);
  
  // Data loading states
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [achievementStats, setAchievementStats] = useState<AchievementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colorScheme = useColorScheme();
  const iconColor = colorScheme === 'dark' ? 'white' : 'black';
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const pulseAnim = useSharedValue(1);

  // Subtle pulse animation on mount
  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // Infinite
      false
    );
  }, []);

  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadProfileData();
      }
    }, [user?.id])
  );

  // Load all profile data
  const loadProfileData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Load user stats and achievement stats in parallel
      const [stats, achStats] = await Promise.all([
        userActivityService.getUserStats(user.id),
        achievementsService.getAchievementStats(user.id)
      ]);

      setUserStats(stats);
      setAchievementStats(achStats);
    } catch (err) {
      console.error('Error loading profile data:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  // Retry loading data
  const handleRetry = () => {
    loadProfileData();
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP);
    return {
      opacity,
    };
  });

  const avatarAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [0, 200],
      [1, 0.8],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, 200],
      [0, -30],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollY.value,
      [0, 150],
      [1, 0],
      Extrapolation.CLAMP
    );
    
    return {
      transform: [
        { scale: scale * pulseAnim.value },
        { translateY }
      ],
      opacity,
    };
  });

  const headerTextAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, 200],
      [0, -20],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollY.value,
      [0, 100],
      [1, 0],
      Extrapolation.CLAMP
    );
    
    return {
      transform: [{ translateY }],
      opacity,
    };
  });

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    const result = await updateUser({ name: name.trim(), email: email.trim() });
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleCancel = () => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setIsEditing(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (user?.id) {
        // Clear caches
        await Promise.all([
          userActivityService.clearUserStatsCache(user.id),
          achievementsService.clearUserCache(user.id)
        ]);
        
        // Reload data
        await loadProfileData();
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Quick actions configuration
  const quickActions: QuickAction[] = [
    {
      id: 'notifications',
      icon: 'notifications',
      label: 'Notifications',
      route: '/notification-settings'
    },
    {
      id: 'achievements',
      icon: 'trophy',
      label: 'Achievements',
      route: '/achievement-settings'
    },
    {
      id: 'connection',
      icon: 'wifi',
      label: 'Connection',
      route: '/connection-test'
    },
    {
      id: 'history',
      icon: 'time',
      label: 'History',
      route: '/history'
    }
  ];

  const handleQuickActionPress = (action: QuickAction) => {
    router.push(action.route as any);
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No user data available</Text>
      </View>
    );
  }

  // Render error state
  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // Render empty state for new users
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>Welcome to StreamScribe!</Text>
      <Text style={styles.emptyText}>
        Start watching shows to see your stats and unlock achievements.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            progressViewOffset={HEADER_HEIGHT + insets.top}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: HEADER_HEIGHT + insets.top + 20 }
        ]}>

        {/* Compact Profile Header with Stats */}
        {!loading && !error && userStats && (
          <CompactProfileHeader
            userName={user.name}
            userEmail={user.email}
            stats={userStats}
            onEditPress={!isEditing ? () => setIsEditing(true) : undefined}
          />
        )}

        {/* Error State */}
        {error && renderErrorState()}

        {/* Loading State */}
        {loading && !error && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        {/* Content - Only show if not loading and no error */}
        {!loading && !error && userStats && achievementStats && (
          <>
            {/* Empty State for New Users */}
            {userStats.totalEpisodes === 0 && userStats.achievementsUnlocked === 0 ? (
              renderEmptyState()
            ) : (
              <>
                {/* Achievement Showcase */}
                <View style={styles.achievementShowcase}>
                  <View style={styles.achievementStatsContainer}>
                    <AchievementStatsCard stats={achievementStats} />
                  </View>
                  <FeaturedAchievements userId={user.id} />
                </View>

                {/* Quick Actions Grid */}
                <QuickActionsGrid 
                  actions={quickActions}
                  onActionPress={handleQuickActionPress}
                />
              </>
            )}
          </>
        )}

        {/* Personal Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          {isEditing ? (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your Name"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Your Email"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.infoList}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{user.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>{new Date(user.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Sticky Header */}
      <Animated.View
        style={[
          styles.headerContainer,
          { height: HEADER_HEIGHT + insets.top, paddingTop: insets.top }
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, headerAnimatedStyle]}>
          <BlurView
            intensity={80}
            tint={colorScheme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={styles.headerContent}>
          <Logo />
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <SymbolView name="gearshape" size={24} tintColor={iconColor} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  achievementShowcase: {
    marginBottom: 24,
  },
  achievementStatsContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  infoList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600',
  },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginTop: 50,
  },
});