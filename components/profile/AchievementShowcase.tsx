import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { AchievementStatsCard } from '../AchievementStatsCard';
import { FeaturedAchievements } from './FeaturedAchievements';
import { Colors } from '../../constants/Colors';
import { AchievementStats } from '../../types';
import { achievementsService } from '../../services/achievements';

interface AchievementShowcaseProps {
  userId: string;
  onRefresh?: () => void;
}

export const AchievementShowcase: React.FC<AchievementShowcaseProps> = ({ 
  userId,
  onRefresh 
}) => {
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const achievementStats = await achievementsService.getAchievementStats(userId);
      setStats(achievementStats);
    } catch (err) {
      console.error('Error loading achievement stats:', err);
      setError('Failed to load achievement stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [userId]);

  const handleRefresh = async () => {
    await achievementsService.clearUserCache(userId);
    await loadStats();
    onRefresh?.();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading achievements...</Text>
        </View>
      </View>
    );
  }

  if (error || !stats) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'No achievement data available'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AchievementStatsCard stats={stats} />
      <FeaturedAchievements userId={userId} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  loadingContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
  },
});
