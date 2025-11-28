import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BrandTokens, Typography, Spacing, BorderRadius, Shadows } from '../constants/BrandTokens';
import { MediaCard } from './MediaCard';
import { useRealTimeUpdates } from './hooks/useRealTimeUpdates';
import { RealTimeUpdate, Movie, TVShow } from '../types';

export interface RealTimeRecommendationWidgetProps {
  onItemPress?: (item: Movie | TVShow, type: 'movie' | 'tv') => void;
}

interface RecommendationItem {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  reason: string;
  timestamp: string;
}

/**
 * RealTimeRecommendationWidget Component
 * 
 * Shows real-time recommendation updates on the home screen.
 * Updates automatically when new recommendations are available.
 */
export const RealTimeRecommendationWidget: React.FC<RealTimeRecommendationWidgetProps> = ({
  onItemPress,
}) => {
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Handle real-time recommendation updates
  useRealTimeUpdates({
    onWatchlistUpdate: (update: RealTimeUpdate) => {
      // Watchlist changes might affect recommendations
      handleRecommendationRefresh();
    },
    onProgressUpdate: (update: RealTimeUpdate) => {
      // Progress changes might affect recommendations
      handleRecommendationRefresh();
    },
  });

  const handleRecommendationRefresh = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      // This would integrate with the recommendation service
      // For now, we'll simulate real-time recommendations
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock real-time recommendations
      const mockRecommendations: RecommendationItem[] = [
        {
          id: 1,
          type: 'tv',
          title: 'New Trending Show',
          poster_path: null,
          vote_average: 8.5,
          first_air_date: '2024-01-15',
          reason: 'Trending now',
          timestamp: new Date().toISOString(),
        },
        {
          id: 2,
          type: 'movie',
          title: 'Recommended Movie',
          poster_path: null,
          vote_average: 7.8,
          release_date: '2024-02-01',
          reason: 'Based on your watchlist',
          timestamp: new Date().toISOString(),
        },
      ];
      
      setRecommendations(mockRecommendations);
      setLastUpdate(new Date().toISOString());
    } catch (error) {
      console.error('Error refreshing recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleRecommendationRefresh();
  }, []);

  const handleItemPress = (item: RecommendationItem) => {
    const baseMediaItem = {
      id: item.id,
      poster_path: item.poster_path,
      vote_average: item.vote_average,
      overview: '',
      backdrop_path: null,
      vote_count: 0,
      genre_ids: [],
      adult: false,
      original_language: '',
      popularity: 0,
    };

    const mediaItem = item.type === 'movie' 
      ? {
          ...baseMediaItem,
          title: item.title,
          release_date: item.release_date || '',
          original_title: item.title,
          video: false,
        } as Movie
      : {
          ...baseMediaItem,
          name: item.title,
          first_air_date: item.first_air_date || '',
          original_name: item.title,
          origin_country: [],
        } as TVShow;

    if (onItemPress) {
      onItemPress(mediaItem, item.type);
    } else {
      router.push(`/details/${item.type}/${item.id}`);
    }
  };

  const formatLastUpdate = (timestamp: string) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const updateTime = new Date(timestamp);
    const diffMs = now.getTime() - updateTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just updated';
    if (diffMins < 60) return `Updated ${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Updated ${diffHours}h ago`;
    
    return 'Updated today';
  };

  if (recommendations.length === 0 && !isLoading) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons name="sparkles" size={20} color={BrandTokens.brandLime} />
          <Text style={styles.title}>Live Recommendations</Text>
          {isLoading && (
            <ActivityIndicator size="small" color={BrandTokens.brandLime} />
          )}
        </View>
        
        {lastUpdate && (
          <Text style={styles.lastUpdate}>
            {formatLastUpdate(lastUpdate)}
          </Text>
        )}
      </View>

      {recommendations.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {recommendations.map((item) => (
            <View key={`${item.type}-${item.id}`} style={styles.itemContainer}>
              <MediaCard
                item={item as any}
                type={item.type}
                onPress={() => handleItemPress(item)}
                onWatchlistPress={() => {}}
                isInWatchlist={false}
                style={styles.mediaCard}
              />
              <View style={styles.reasonContainer}>
                <Text style={styles.reasonText}>{item.reason}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={styles.viewAllButton}
        onPress={() => router.push('/recommendations')}
      >
        <Text style={styles.viewAllText}>View All Recommendations</Text>
        <Ionicons name="chevron-forward" size={16} color={BrandTokens.brandLime} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: BrandTokens.bgDarkGray,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.h2,
    color: BrandTokens.white,
    fontSize: 18,
  },
  lastUpdate: {
    ...Typography.bodySmall,
    color: BrandTokens.mutedGray,
    fontSize: 12,
  },
  scrollContent: {
    paddingRight: Spacing.lg,
  },
  itemContainer: {
    marginRight: Spacing.md,
    width: 120,
  },
  mediaCard: {
    width: 120,
  },
  reasonContainer: {
    marginTop: Spacing.xs,
    backgroundColor: BrandTokens.brandLime,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  reasonText: {
    ...Typography.bodySmall,
    fontSize: 10,
    color: BrandTokens.bgDarkGray,
    fontWeight: '600',
    textAlign: 'center',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: BrandTokens.brandLime,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  viewAllText: {
    ...Typography.bodySmall,
    color: BrandTokens.brandLime,
    fontWeight: '600',
  },
});