import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { achievementsService } from '../services/achievements';
import { AchievementCard } from '../components/AchievementCard';
import { AchievementStatsCard } from '../components/AchievementStatsCard';
import AchievementDetailModal from '../components/AchievementDetailModal';
import { Colors } from '../constants/Colors';
import {
  Achievement,
  UserAchievement,
  AchievementProgress,
  AchievementStats,
} from '../types';

type CategoryType = 'all' | 'viewing' | 'streaks' | 'completions' | 'savings' | 'efficiency';

interface CategoryTab {
  key: CategoryType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const CATEGORY_TABS: CategoryTab[] = [
  { key: 'all', label: 'All', icon: 'grid' },
  { key: 'viewing', label: 'Viewing', icon: 'play-circle' },
  { key: 'streaks', label: 'Streaks', icon: 'flame' },
  { key: 'completions', label: 'Completions', icon: 'checkmark-circle' },
  { key: 'savings', label: 'Savings', icon: 'cash' },
  { key: 'efficiency', label: 'Efficiency', icon: 'speedometer' },
];

export default function AchievementsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  
  // State
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [achievementProgress, setAchievementProgress] = useState<AchievementProgress[]>([]);
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [user]);

  // Handle deep link to specific achievement
  useEffect(() => {
    if (params.achievementId && allAchievements.length > 0) {
      const achievement = allAchievements.find(a => a.id === params.achievementId);
      if (achievement) {
        setSelectedAchievement(achievement);
        setModalVisible(true);
      }
    }
  }, [params.achievementId, allAchievements]);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Fetch all data in parallel
      const [achievements, userAchs, progress, achievementStats] = await Promise.all([
        achievementsService.getAllAchievements(),
        achievementsService.getUserAchievements(user.id),
        achievementsService.getAchievementProgress(user.id),
        achievementsService.getAchievementStats(user.id),
      ]);

      setAllAchievements(achievements);
      setUserAchievements(userAchs);
      setAchievementProgress(progress);
      setStats(achievementStats);
    } catch (err) {
      console.error('Error loading achievements:', err);
      setError('Unable to load achievements. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [user]);

  const handleRetry = () => {
    setLoading(true);
    loadData();
  };

  const handleAchievementPress = (achievement: Achievement) => {
    setSelectedAchievement(achievement);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setSelectedAchievement(null);
  };

  // Get filtered and sorted achievements
  const getFilteredAchievements = (): Achievement[] => {
    let filtered = allAchievements;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(a => a.category === selectedCategory);
    }

    // Sort by sort_order
    filtered = [...filtered].sort((a, b) => a.sort_order - b.sort_order);

    return filtered;
  };

  // Separate unlocked and locked achievements
  const getSeparatedAchievements = () => {
    const filtered = getFilteredAchievements();
    const unlockedIds = new Set(userAchievements.map(ua => ua.achievement_id));

    const unlocked = filtered.filter(a => unlockedIds.has(a.id));
    const locked = filtered.filter(a => !unlockedIds.has(a.id));

    return { unlocked, locked };
  };

  // Get user achievement for an achievement
  const getUserAchievement = (achievementId: string): UserAchievement | undefined => {
    return userAchievements.find(ua => ua.achievement_id === achievementId);
  };

  // Get progress for an achievement
  const getProgress = (achievementId: string): AchievementProgress | undefined => {
    return achievementProgress.find(p => p.achievement_id === achievementId);
  };

  // Render category tabs
  const renderCategoryTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabsContainer}
      contentContainerStyle={styles.tabsContent}
    >
      {CATEGORY_TABS.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            selectedCategory === tab.key && styles.tabActive,
          ]}
          onPress={() => setSelectedCategory(tab.key)}
        >
          <Ionicons
            name={tab.icon}
            size={18}
            color={selectedCategory === tab.key ? Colors.primary : Colors.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              selectedCategory === tab.key && styles.tabTextActive,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // Render achievement list
  const renderAchievementList = () => {
    const { unlocked, locked } = getSeparatedAchievements();

    if (unlocked.length === 0 && locked.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Achievements Yet</Text>
          <Text style={styles.emptyText}>
            Start watching episodes to unlock your first achievement!
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.achievementList}>
        {/* Unlocked Achievements */}
        {unlocked.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Unlocked ({unlocked.length})
            </Text>
            {unlocked.map(achievement => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                userAchievement={getUserAchievement(achievement.id)}
                progress={getProgress(achievement.id)}
                onPress={() => handleAchievementPress(achievement)}
              />
            ))}
          </View>
        )}

        {/* Locked Achievements */}
        {locked.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Locked ({locked.length})
            </Text>
            {locked.map(achievement => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                userAchievement={getUserAchievement(achievement.id)}
                progress={getProgress(achievement.id)}
                onPress={() => handleAchievementPress(achievement)}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  // Loading state
  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Achievements',
            headerRight: () => (
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => router.push('/achievement-settings' as any)}
              >
                <Ionicons name="settings-outline" size={24} color={Colors.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading achievements...</Text>
          </View>
        </View>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Achievements',
            headerRight: () => (
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => router.push('/achievement-settings' as any)}
              >
                <Ionicons name="settings-outline" size={24} color={Colors.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={64} color={Colors.error} />
            <Text style={styles.errorTitle}>Oops!</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  // Main content
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Achievements',
          headerRight: () => (
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => router.push('/achievement-settings' as any)}
            >
              <Ionicons name="settings-outline" size={24} color={Colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {/* Stats Card */}
          {stats && <AchievementStatsCard stats={stats} />}

          {/* Category Tabs */}
          {renderCategoryTabs()}

          {/* Achievement List */}
          {renderAchievementList()}
        </ScrollView>

        {/* Detail Modal */}
        {selectedAchievement && (
          <AchievementDetailModal
            achievement={selectedAchievement}
            userAchievement={getUserAchievement(selectedAchievement.id)}
            progress={getProgress(selectedAchievement.id)}
            visible={modalVisible}
            onClose={handleModalClose}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  settingsButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  tabsContainer: {
    marginBottom: 16,
  },
  tabsContent: {
    paddingRight: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.card,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    marginLeft: 6,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  achievementList: {
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
