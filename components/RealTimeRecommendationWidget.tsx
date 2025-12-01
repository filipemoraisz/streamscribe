import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BrandTokens, Typography, Spacing, BorderRadius, Shadows } from '../constants/BrandTokens';
import { Colors } from '../constants/Colors';
import { MediaCard } from './MediaCard';
import { useAuth } from '../contexts/AuthContext';
import { Movie, TVShow } from '../types';

export interface RealTimeRecommendationWidgetProps {
  onItemPress?: (item: Movie | TVShow, type: 'movie' | 'tv') => void;
  refreshTrigger?: number; // Change this value to trigger a refresh
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
  providerName: string;
  providerLogoUrl?: string;
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
  refreshTrigger,
}) => {
  const { user, preferences } = useAuth();
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [hasSubscriptions, setHasSubscriptions] = useState(true);

  // Real-time updates will trigger a refresh via refreshTrigger prop
  // No need for complex optimistic update logic here

  const handleRecommendationRefresh = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      // Small delay to ensure Supabase session is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));
      
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
      // Force refresh to get latest data based on current watchlist
      const monthlyRecs = await recommendationService.generateMonthlyRecommendations(true);
      
      console.log('[RealTimeRecommendationWidget] Monthly recommendations:', {
        totalWatchlistItems: monthlyRecs.totalWatchlistItems,
        topProvidersCount: monthlyRecs.topProviders.length,
      });
      
      // Check if user has subscribed services configured
      const subscribedServices = preferences?.subscribed_services || [];
      
      if (subscribedServices.length === 0) {
        console.log('[RealTimeRecommendationWidget] No subscribed services configured');
        setHasSubscriptions(false);
        setRecommendations([]);
        setLastUpdate(new Date().toISOString());
        return;
      }
      
      setHasSubscriptions(true);
      
      // Filter to only show providers the user is subscribed to
      const subscribedProviders = monthlyRecs.topProviders.filter(provider => 
        subscribedServices.includes(provider.providerId)
      );
      
      console.log('[RealTimeRecommendationWidget] Subscribed providers:', {
        userSubscriptions: subscribedServices,
        allProviders: monthlyRecs.topProviders.map(p => ({ id: p.providerId, name: p.providerName })),
        matchingProviders: subscribedProviders.length,
      });
      
      // If no matching providers, still show we have subscriptions configured
      // but no content available on those services
      if (subscribedProviders.length === 0) {
        console.log('[RealTimeRecommendationWidget] No content available on subscribed services');
        setRecommendations([]);
        setLastUpdate(new Date().toISOString());
        return;
      }
      
      // Convert provider recommendations to widget format
      const widgetRecommendations: RecommendationItem[] = [];
      
      // Get content from subscribed providers only
      const topProviders = subscribedProviders.slice(0, 2); // Take top 2 subscribed providers
      
      console.log('[RealTimeRecommendationWidget] Processing providers:', topProviders.map(p => ({
        id: p.providerId,
        name: p.providerName,
        movies: p.availableContent.movies.length,
        tvShows: p.availableContent.tvShows.length,
        movieTitles: p.availableContent.movies.map(m => m.title),
        tvTitles: p.availableContent.tvShows.map(tv => tv.title),
      })));
      
      topProviders.forEach(provider => {
        console.log(`[RealTimeRecommendationWidget] Processing ${provider.providerName}:`, {
          movies: provider.availableContent.movies.length,
          tvShows: provider.availableContent.tvShows.length,
        });
        
        // Add some movies from this provider
        // These are items FROM your watchlist that are available on this provider
        const movies = provider.availableContent.movies.slice(0, 3);
        console.log(`[RealTimeRecommendationWidget] Adding ${movies.length} movies from ${provider.providerName}`);
        movies.forEach(item => {
          widgetRecommendations.push({
            id: item.id,
            type: 'movie',
            title: item.title,
            poster_path: item.poster_path,
            vote_average: item.vote_average,
            release_date: item.release_date,
            reason: `Available on ${provider.providerName}`,
            providerName: provider.providerName,
            providerLogoUrl: provider.logoUrl,
            timestamp: new Date().toISOString(),
          });
        });
        
        // Add some TV shows from this provider
        // These are items FROM your watchlist that are available on this provider
        const tvShows = provider.availableContent.tvShows.slice(0, 3);
        console.log(`[RealTimeRecommendationWidget] Adding ${tvShows.length} TV shows from ${provider.providerName}`);
        tvShows.forEach(item => {
          widgetRecommendations.push({
            id: item.id,
            type: 'tv',
            title: item.title,
            poster_path: item.poster_path,
            vote_average: item.vote_average,
            first_air_date: item.first_air_date,
            reason: `Available on ${provider.providerName}`,
            providerName: provider.providerName,
            providerLogoUrl: provider.logoUrl,
            timestamp: new Date().toISOString(),
          });
        });
      });
      
      // No need to filter - these ARE items from your watchlist
      // The widget shows which streaming services have your watchlist content
      
      console.log('[RealTimeRecommendationWidget] Final recommendations:', {
        total: widgetRecommendations.length,
        watchlistSize: watchlistIds.size,
      });
      
      setRecommendations(widgetRecommendations.slice(0, 4)); // Limit to 4 items
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
    // Only load recommendations when user is authenticated
    if (user) {
      console.log('[RealTimeRecommendationWidget] User authenticated, loading recommendations for:', user.id);
      console.log('[RealTimeRecommendationWidget] User preferences:', {
        hasPreferences: !!preferences,
        subscribedServices: preferences?.subscribed_services || [],
      });
      handleRecommendationRefresh();
    } else {
      console.log('[RealTimeRecommendationWidget] No user yet, waiting for authentication');
    }
  }, [user, preferences, refreshTrigger]); // Also refresh when preferences or refreshTrigger changes

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

  // Don't show anything if user is not authenticated
  if (!user) {
    return null;
  }

  // Show empty state if no subscriptions configured
  if (!hasSubscriptions && !isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <Ionicons name="tv-outline" size={18} color="#FF6B35" />
              <Text style={styles.title}>Watch Now</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.emptyState}>
          <Ionicons name="information-circle-outline" size={32} color={BrandTokens.mutedGray} />
          <Text style={styles.emptyStateText}>
            Tell us about what subscriptions you have to get live recommendations about what to watch next
          </Text>
          <TouchableOpacity
            style={styles.setupButton}
            onPress={() => router.push('/(onboarding)/services')}
          >
            <Text style={styles.setupButtonText}>Set Up Subscriptions</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show empty state if user has subscriptions but no matching content
  if (recommendations.length === 0 && !isLoading && hasSubscriptions) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <Ionicons name="tv" size={18} color="#FF6B35" />
              <Text style={styles.title}>Watch Now</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.emptyState}>
          <Ionicons name="film-outline" size={32} color={BrandTokens.mutedGray} />
          <Text style={styles.emptyStateText}>
            None of your watchlist items are available on your current streaming services
          </Text>
          <Text style={styles.emptyStateSubtext}>
            Add more items to your watchlist or update your subscriptions
          </Text>
        </View>
      </View>
    );
  }

  if (recommendations.length === 0 && !isLoading) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Ionicons name="tv" size={18} color="#FF6B35" />
            <Text style={styles.title}>Watch Now</Text>
            {isLoading && (
              <ActivityIndicator size="small" color="#FF6B35" />
            )}
          </View>
          <Text style={styles.subtitle}>From your streaming services</Text>
        </View>
        
        <View style={styles.headerRight}>
          {lastUpdate && (
            <Text style={styles.lastUpdate}>
              {formatLastUpdate(lastUpdate)}
            </Text>
          )}
          <TouchableOpacity onPress={() => router.push('/recommendations')}>
            <Text style={styles.viewAllLink}>View All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {recommendations.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {recommendations.map((item) => (
            <TouchableOpacity
              key={`${item.type}-${item.id}`}
              style={styles.itemContainer}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.posterContainer}>
                {item.poster_path ? (
                  <Image
                    source={{ uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }}
                    style={styles.poster}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.posterPlaceholder}>
                    <Ionicons name="film-outline" size={32} color={BrandTokens.mutedGray} />
                  </View>
                )}
                
                {/* Provider badge overlay on top-left */}
                <View style={styles.providerBadgeOverlay}>
                  <Text style={styles.watchOnText}>WATCH ON</Text>
                  {item.providerLogoUrl ? (
                    <Image
                      source={{ uri: item.providerLogoUrl }}
                      style={styles.providerLogoSmall}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.providerNameTextSmall}>{item.providerName}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}


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
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  title: {
    ...Typography.h2,
    color: BrandTokens.white,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    ...Typography.bodySmall,
    color: BrandTokens.mutedGray,
    fontSize: 11,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  lastUpdate: {
    ...Typography.bodySmall,
    color: BrandTokens.mutedGray,
    fontSize: 11,
  },
  viewAllLink: {
    ...Typography.bodySmall,
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    paddingRight: Spacing.lg,
  },
  itemContainer: {
    marginRight: Spacing.md,
    width: 110,
  },
  posterContainer: {
    width: 110,
    height: 165,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.surface,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  providerBadgeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#000000',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderBottomRightRadius: 8,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  watchOnText: {
    ...Typography.bodySmall,
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  providerLogoSmall: {
    width: 42,
    height: 16,
  },
  providerNameTextSmall: {
    ...Typography.bodySmall,
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  emptyStateText: {
    ...Typography.body,
    color: BrandTokens.mutedGray,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  emptyStateSubtext: {
    ...Typography.bodySmall,
    color: BrandTokens.mutedGray,
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.7,
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FF6B35',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  setupButtonText: {
    ...Typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});