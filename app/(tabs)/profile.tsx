import { BlurView } from 'expo-blur';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
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
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function ProfileScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  
  // Data loading states
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [achievementStats, setAchievementStats] = useState<AchievementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Persistence and scroll position
  const scrollRef = useRef<Animated.ScrollView>(null);
  const savedScrollPosition = useRef(0);
  const lastLoadTime = useRef<number>(0);
  const isInitialLoad = useRef(true);

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
        const now = Date.now();
        const timeSinceLastLoad = now - lastLoadTime.current;
        
        // Only reload if cache is expired or it's the initial load
        if (isInitialLoad.current || timeSinceLastLoad > CACHE_DURATION) {
          loadProfileData();
          isInitialLoad.current = false;
        } else {
          console.log('[Profile] Using cached data, skipping reload');
        }
        
        // Restore scroll position after a short delay
        setTimeout(() => {
          if (savedScrollPosition.current > 0 && scrollRef.current) {
            scrollRef.current.scrollTo({ 
              y: savedScrollPosition.current, 
              animated: false 
            });
          }
        }, 100);
      }
    }, [user?.id])
  );

  // Load all profile data
  const loadProfileData = async () => {
    if (!user?.id) return;

    try {
      // Only show loading spinner on initial load
      if (!userStats && !achievementStats) {
        setLoading(true);
      }
      setError(null);

      // Load user stats and achievement stats in parallel
      const [stats, achStats] = await Promise.all([
        userActivityService.getUserStats(user.id),
        achievementsService.getAchievementStats(user.id)
      ]);

      setUserStats(stats);
      setAchievementStats(achStats);
      lastLoadTime.current = Date.now();
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
      // Save scroll position
      savedScrollPosition.current = event.contentOffset.y;
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



  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (user?.id) {
        // Clear caches
        await Promise.all([
          userActivityService.clearUserStatsCache(user.id),
          achievementsService.clearUserCache(user.id)
        ]);
        
        // Force reload by resetting cache time
        lastLoadTime.current = 0;
        
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
      route: '/notifications'
    },
    {
      id: 'achievements',
      icon: 'trophy',
      label: 'Achievements',
      route: '/achievements'
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
    console.log('[Profile] Quick action pressed:', action.id, action.route);
    try {
      console.log('[Profile] Attempting navigation to:', action.route);
      router.push(action.route as any);
      console.log('[Profile] Navigation call completed');
    } catch (error) {
      console.error('[Profile] Navigation error:', error);
    }
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
        ref={scrollRef}
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
          <>
            <CompactProfileHeader
              userName={user.name}
              userEmail={user.email}
              stats={userStats}
              profileImage={user.profileImage}
              onEditPress={() => router.push('/edit-profile' as any)}
            />
            
            {/* Quick Actions Grid - Right below profile header */}
            <QuickActionsGrid 
              actions={quickActions}
              onActionPress={handleQuickActionPress}
            />
          </>
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
              </>
            )}
          </>
        )}


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
            intensity={95}
            tint="dark"
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

  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginTop: 50,
  },
});