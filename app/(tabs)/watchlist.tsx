import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ActivityIndicator, Dimensions, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, { 
  Extrapolation, 
  interpolate, 
  useAnimatedScrollHandler, 
  useAnimatedStyle, 
  useSharedValue 
} from 'react-native-reanimated';
import { MediaCard } from '../../components/MediaCard';
import { FilterType, WatchlistFilter } from '../../components/WatchlistFilter';
import { CustomTabHeader } from '../../components/CustomTabHeader';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { useRealTimeStatus } from '../../components/hooks/useRealTimeStatus';
import { useAutoRefreshOnUpdates } from '../../components/hooks/useRealTimeUpdates';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { progressService } from '../../services/progress';
import { storageService } from '../../services/storage';
import { ShowProgress, WatchlistItem } from '../../types';

const { width } = Dimensions.get('window');
const numColumns = 2;
const GAP = 16;
const PADDING = 16;
const itemWidth = (width - (PADDING * 2) - (GAP * (numColumns - 1))) / numColumns;
const HEADER_HEIGHT = 110; // Header + Filter height

export default function WatchlistScreen() {
  const { user } = useAuth();
  const realTimeStatus = useRealTimeStatus();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [showProgress, setShowProgress] = useState<Map<number, ShowProgress>>(new Map());
  const [filter, setFilter] = useState<FilterType>((params.filter as FilterType) || 'all');
  
  const scrollY = useSharedValue(0);

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [nextEpisodes, setNextEpisodes] = useState<Record<number, { season: number; episode: number }>>({});

  // Refs to track current state for use inside callbacks (avoiding stale closures)
  const watchlistRef = useRef(watchlist);
  const showProgressRef = useRef(showProgress);

  useEffect(() => {
    watchlistRef.current = watchlist;
    showProgressRef.current = showProgress;
  }, [watchlist, showProgress]);

  // Auto-refresh on real-time updates
  useAutoRefreshOnUpdates(useCallback(() => {
    if (!isLoading && !isRefreshing) {
      loadWatchlist(false);
    }
  }, [isLoading, isRefreshing]));

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login');
    }
  }, [user]);

  // Update filter when navigation params change - always override current filter
  useFocusEffect(
    React.useCallback(() => {
      if (params.filter) {
        setFilter(params.filter as FilterType);
      }
    }, [params.filter])
  );

  useFocusEffect(
    React.useCallback(() => {
      loadWatchlist();
    }, [])
  );

  const loadWatchlist = async (isRefresh = false) => {
    try {
      // Use ref to check current length to avoid stale closure
      if (!isRefresh && watchlistRef.current.length === 0) {
        setIsLoading(true);
      }
      setError(null);
      const [items, progressList] = await Promise.all([
        storageService.getWatchlist(),
        progressService.getAllShowsProgress()
      ]);

      const progressMap = new Map(progressList.map(p => [p.show_id, p]));

      // Compare with ref.current to get latest state
      if (JSON.stringify(items) !== JSON.stringify(watchlistRef.current)) {
        setWatchlist(items);
      }

      const currentProgressArray = Array.from(showProgressRef.current.entries());
      const newProgressArray = Array.from(progressMap.entries());
      if (JSON.stringify(currentProgressArray) !== JSON.stringify(newProgressArray)) {
        setShowProgress(progressMap);
      }

      // Fetch next episodes for TV shows - OPTIMIZED: Single batch query instead of N queries
      const tvWatchlist = items.filter(item => item.type === 'tv');
      const showIds = tvWatchlist.map(item => item.id);
      
      const nextEpisodesMap = await progressService.getNextEpisodesForShows(showIds);
      
      const nextEps: Record<number, { season: number; episode: number }> = {};
      nextEpisodesMap.forEach((value, key) => {
        nextEps[key] = value;
      });
      setNextEpisodes(nextEps);

    } catch (error) {
      console.error('Error loading watchlist:', error);
      setError('Failed to load your watchlist. Please try again.');
    } finally {
      if (!isRefresh) {
        setIsLoading(false);
      }
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadWatchlist(true);
    setIsRefreshing(false);
  };

  const handleItemPress = (item: WatchlistItem) => {
    router.push(`/details/${item.type}/${item.id}`);
  };

  const handleWatchlistPress = async (item: WatchlistItem) => {
    try {
      await storageService.removeFromWatchlist(item.id, item.type);
      await loadWatchlist(false);
    } catch (error) {
      console.error('Error removing from watchlist:', error);
    }
  };

  const handleQuickMarkEpisode = async (item: WatchlistItem, season: number, episode: number) => {
    try {
      // Optimistic update: Update next episode locally immediately
      const currentNext = nextEpisodes[item.id];
      if (currentNext) {
        setNextEpisodes(prev => ({
          ...prev,
          [item.id]: { season: currentNext.season, episode: currentNext.episode + 1 }
        }));
      }

      // Mark as watched in background
      await progressService.markEpisodeWatched(item.id, season, episode);

      // Refresh data silently to ensure consistency
      await loadWatchlist(false);
    } catch (error) {
      console.error('Error marking episode watched:', error);
      // Revert on error (optional, but good practice)
      loadWatchlist(false);
    }
  };

  const handleQuickMarkMovie = async (item: WatchlistItem) => {
    try {
      // Optimistic update: Remove from list if filtering by active/unwatched
      if (filter === 'active' || filter === 'movies') {
        // We could filter it out locally, but for now let's just trigger the background update
        // and let the list refresh naturally. To make it instant, we'd need to update 'watchlist' state.
        // Let's update local state to reflect 'watched' status immediately
        setWatchlist(prev => prev.map(i =>
          i.id === item.id && i.type === 'movie' ? { ...i, watched: true } : i
        ));
      }

      await storageService.toggleWatched(item.id, item.type);
      await loadWatchlist(false);
    } catch (error) {
      console.error('Error toggling movie watched:', error);
    }
  };

  const getSortedAndFilteredWatchlist = () => {
    // 1. Filter by Category
    let filtered = watchlist;

    if (filter === 'movies') {
      filtered = filtered.filter(item => item.type === 'movie');
    } else if (filter === 'active') {
      filtered = filtered.filter(item => {
        if (item.type === 'movie') return !item.watched;
        const progress = showProgress.get(item.id);
        return progress?.status === 'watching' || (!progress && !item.watched);
      });
    } else if (filter === 'up_to_date') {
      filtered = filtered.filter(item => {
        if (item.type === 'movie') return false;
        const progress = showProgress.get(item.id);
        return progress?.status === 'up_to_date';
      });
    }

    // 2. Filter out Completed/Up-to-date items (they go to History)
    // UNLESS we are specifically filtering for them
    if (filter !== 'up_to_date') {
      const activeItems: WatchlistItem[] = [];

      filtered.forEach(item => {
        const isMovie = item.type === 'movie';
        const progress = showProgress.get(item.id);

        const isCompleted = isMovie
          ? item.watched
          : (progress?.status === 'completed' || progress?.status === 'up_to_date');

        if (!isCompleted) {
          activeItems.push(item);
        }
      });
      filtered = activeItems;
    }

    const activeItems = filtered;

    // 3. Sort Active Items by Priority
    // Priority: Watching > Plan to Watch (No progress)
    activeItems.sort((a, b) => {
      const getPriority = (item: WatchlistItem) => {
        if (item.type === 'movie') return 3; // Plan to watch
        const p = showProgress.get(item.id);
        if (!p) return 3; // Plan to watch
        if (p.status === 'watching') return 1;
        return 3;
      };

      const priorityA = getPriority(a);
      const priorityB = getPriority(b);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Secondary sort: Last watched or Added date
      const dateA = new Date(a.added_date).getTime();
      const dateB = new Date(b.added_date).getTime();
      return dateB - dateA;
    });

    return activeItems;
  };

  const renderStatusBadge = (item: WatchlistItem) => {
    if (item.type === 'movie') {
      return null; // Movies in this list are unwatched
    }

    const progress = showProgress.get(item.id);
    if (!progress) return null;

    if (progress.status === 'watching') {
      return (
        <View style={[styles.badge, { backgroundColor: Colors.warning }]}>
          <Text style={styles.badgeText}>Watching</Text>
        </View>
      );
    }
    return null;
  };

  const renderItem = ({ item }: { item: WatchlistItem }) => {
    const mediaItem = {
      id: item.id,
      title: item.title,
      name: item.title,
      poster_path: item.poster_path,
      release_date: item.release_date || '',
      first_air_date: item.first_air_date || '',
      vote_average: item.vote_average,
      overview: '',
      backdrop_path: null,
      vote_count: 0,
      genre_ids: [],
      adult: false,
      original_language: '',
      original_title: item.title,
      original_name: item.title,
      popularity: 0,
      video: false,
      origin_country: [],
    };

    const nextEpisode = item.type === 'tv' ? nextEpisodes[item.id] : undefined;

    return (
      <View style={[styles.cardContainer, { width: itemWidth }]}>
        <View>
          <MediaCard
            item={mediaItem}
            type={item.type}
            onPress={() => handleItemPress(item)}
            onWatchlistPress={() => handleWatchlistPress(item)}
            isInWatchlist={true}
            style={{ width: '100%' }}
            nextEpisode={nextEpisode}
            onNextEpisodePress={
              item.type === 'tv' && nextEpisode
                ? () => handleQuickMarkEpisode(item, nextEpisode.season, nextEpisode.episode)
                : undefined
            }
            onMovieActionPress={
              item.type === 'movie'
                ? () => handleQuickMarkMovie(item)
                : undefined
            }
          />
          <View style={styles.badgeContainer}>
            {renderStatusBadge(item)}
          </View>
        </View>
      </View>
    );
  };

  const activeItems = getSortedAndFilteredWatchlist();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadWatchlist()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Connection Status Banner */}
      <ConnectionBanner 
        isConnected={realTimeStatus.isConnected}
        isConnecting={realTimeStatus.isConnecting}
      />

      {activeItems.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingTop: HEADER_HEIGHT + insets.top }]}>
          <Ionicons name="film-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No content found</Text>
          <Text style={styles.emptyText}>
            {filter === 'all'
              ? 'Your watchlist is empty'
              : `No items in "${filter.replace('_', ' ')}"`}
          </Text>
        </View>
      ) : (
        <Animated.FlatList
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          data={activeItems}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          numColumns={numColumns}
          contentContainerStyle={[
            styles.listContainer,
            { 
              paddingTop: HEADER_HEIGHT + insets.top + 16,
              paddingBottom: insets.bottom + 100 // Add extra padding for tab bar
            }
          ]}
          columnWrapperStyle={[styles.row, { gap: GAP }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              progressViewOffset={HEADER_HEIGHT + insets.top}
            />
          }
        />
      )}

      {/* Sticky Header with Blur */}
      <CustomTabHeader
        title="Watchlist"
        headerAnimatedStyle={headerAnimatedStyle}
        height={HEADER_HEIGHT + insets.top}
        paddingTop={insets.top}
        rightButton={
          <TouchableOpacity onPress={() => router.push('/history')}>
            <Ionicons name="list-outline" size={24} color={Colors.text} />
          </TouchableOpacity>
        }
      >
        <WatchlistFilter activeFilter={filter} onFilterChange={setFilter} />
      </CustomTabHeader>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appIcon: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  archiveButton: {
    padding: 8,
  },
  listContainer: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  cardContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
