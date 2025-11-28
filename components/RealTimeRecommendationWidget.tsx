import React, { useState, useEffect, useCallback } from 'react';
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
import { useOptimisticUpdates } from './hooks/useOptimisticUpdates';
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
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());

  // Use optimistic updates for immediate UI responsiveness
  const { applyOptimisticUpdate, revertOptimisticUpdate } = useOptimisticUpdates();

  // Handle real-time recommendation updates
  useRealTimeUpdates({
    onWatchlistUpdate: (update: RealTimeUpdate) => {
      handleWatchlistUpdate(update);
    },
    onProgressUpdate: (update: RealTimeUpdate) => {
      // Progress changes might affect recommendations
      handleRecommendationRefresh();
    },
  });

  // Handle watchlist updates with immediate UI response
  const handleWatchlistUpdate = useCallback((update: RealTimeUpdate) => {
    if (update.type === 'watchlist_add') {
      const itemKey = `${update.contentType}-${update.contentId}`;
      
      // Immediately remove from recommendations (optimistic update)
      setRecommendations(prev => 
        prev.filter(item => `${item.type}-${item.id}` !== itemKey)
      );
      
      // Update watchlist tracking
      setWatchlistIds(prev => new Set(prev).add(itemKey));
      
      // Apply optimistic update for cross-component consistency
      applyOptimisticUpdate({
        id: `recommendation-remove-${itemKey}`,
        type: 'recommendation_remove',
        data: { itemKey },
        timestamp: Date.now(),
      });
    } else if (update.type === 'watchlist_remove') {
      const itemKey = `${update.contentType}-${update.contentId}`;
      
      // Remove from watchlist tracking
      setWatchlistIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemKey);
        return newSet;
      });
      
      // Refresh recommendations to potentially add it back
      handleRecommendationRefresh();
    }
  }, [applyOptimisticUpdate]);

  const handleRecommendationRefresh = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      // Import services dynamically to avoid circular dependencies
      const [{ recommendationService }, { storageService }] = await Promise.all([
        import('../services/recommendations'),
        import('../services/storage')
      ]);
      
      // Get current watchlist to filter out items already added
      const currentWatchlist = await storageService.getWatchlist();
      const watchlistItemKeys = new Set(
        currentWatchlist.map(item => `${item.type}-${item.id}`)
      );
      setWatchlistIds(watchlistItemKeys);
      
      // Get real recommendations from the service
      const monthlyRecs = await recommendationService.generateMonthlyRecommendations();
      
      // Convert provider recommendations to widget format
      const widgetRecommendations: RecommendationItem[] = [];
      
      // Get content from top providers
      const topProviders = monthlyRecs.topProviders.slice(0, 2); // Take top 2 providers
      
      topProviders.forEach(provider => {
        // Add some movies from this provider
        const movies = provider.availableContent.movies.slice(0, 3);
        movies.forEach(item => {
          const itemKey = `movie-${item.id}`;
          // Skip if already in watchlist
          if (!watchlistItemKeys.has(itemKey)) {
            widgetRecommendations.push({
              id: item.id,
              type: 'movie',
              title: item.title,
              poster_path: item.poster_path,
              vote_average: item.vote_average,
              release_date: item.release_date,
              reason: `Available on ${provider.providerName}`,
              timestamp: new Date().toISOString(),
            });
          }
        });
        
        // Add some TV shows from this provider
        const tvShows = provider.availableContent.tvShows.slice(0, 3);
        tvShows.forEach(item => {
          const itemKey = `tv-${item.id}`;
          // Skip if already in watchlist
          if (!watchlistItemKeys.has(itemKey)) {
            widgetRecommendations.push({
              id: item.id,
              type: 'tv',
              title: item.title,
              poster_path: item.poster_path,
              vote_average: item.vote_average,
              first_air_date: item.first_air_date,
              reason: `Available on ${provider.providerName}`,
              timestamp: new Date().toISOString(),
            });
          }
        });
      });
      
      // Filter out any items that are in the current watchlist (double-check)
      const filteredRecommendations = widgetRecommendations.filter(item => {
        const itemKey = `${item.type}-${item.id}`;
        return !watchlistIds.has(itemKey);
      });
      
      setRecommendations(filteredRecommendations.slice(0, 4)); // Limit to 4 items
      setLastUpdate(new Date().toISOString());
    } catch (error) {
      console.error('Error refreshing recommendations:', error);
      // Fallback to empty state on error
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, watchlistIds]);

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
          <Ionicons name="sparkles" size={20} color="#FF6B35" />
          <Text style={styles.title}>Live Recommendations</Text>
          {isLoading && (
            <ActivityIndicator size="small" color="#FF6B35" />
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
                onWatchlistPress={async () => {
                  // Handle watchlist addition with optimistic update
                  const itemKey = `${item.type}-${item.id}`;
                  
                  // Immediately remove from recommendations
                  setRecommendations(prev => 
                    prev.filter(rec => `${rec.type}-${rec.id}` !== itemKey)
                  );
                  
                  try {
                    // Import storage service and add to watchlist
                    const { storageService } = await import('../services/storage');
                    
                    const mediaItem = item.type === 'movie' 
                      ? {
                          id: item.id,
                          title: item.title,
                          poster_path: item.poster_path,
                          vote_average: item.vote_average,
                          release_date: item.release_date || '',
                          overview: '',
                          backdrop_path: null,
                          vote_count: 0,
                          genre_ids: [],
                          adult: false,
                          original_language: '',
                          original_title: item.title,
                          popularity: 0,
                          video: false,
                        } as Movie
                      : {
                          id: item.id,
                          name: item.title,
                          poster_path: item.poster_path,
                          vote_average: item.vote_average,
                          first_air_date: item.first_air_date || '',
                          overview: '',
                          backdrop_path: null,
                          vote_count: 0,
                          genre_ids: [],
                          adult: false,
                          original_language: '',
                          original_name: item.title,
                          popularity: 0,
                          origin_country: [],
                        } as TVShow;
                    
                    await storageService.addToWatchlist(mediaItem);
                    
                    // Update watchlist tracking
                    setWatchlistIds(prev => new Set(prev).add(itemKey));
                  } catch (error) {
                    console.error('Error adding to watchlist:', error);
                    // Revert optimistic update on error
                    setRecommendations(prev => [...prev, item]);
                  }
                }}
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
        <Ionicons name="chevron-forward" size={16} color="#FF6B35" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2A2A2A', // Dark gray background
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: '#3A3A3A', // Slightly lighter gray border
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
    backgroundColor: '#FF6B35', // Vivid orange background
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  reasonText: {
    ...Typography.bodySmall,
    fontSize: 10,
    color: '#FFFFFF', // White text for better contrast
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
    borderColor: '#FF6B35', // Vivid orange border
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    backgroundColor: 'rgba(255, 107, 53, 0.1)', // Subtle orange background
  },
  viewAllText: {
    ...Typography.bodySmall,
    color: '#FF6B35', // Vivid orange text
    fontWeight: '600',
  },
});