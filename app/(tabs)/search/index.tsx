import { Stack, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CategoryCard } from '../../../components/CategoryCard';
import { MediaCard } from '../../../components/MediaCard';
import { Colors } from '../../../constants/Colors';
import { useAuth } from '../../../contexts/AuthContext';
import { storageService } from '../../../services/storage';
import { tmdbService } from '../../../services/tmdb';
import { Movie, TVShow } from '../../../types';

const MOVIE_CATEGORIES = [
  { id: 'trending', title: 'Trending Now', colors: ['#FF2E00', '#FF8C00'] as const, icon: 'flame.fill' },
  { id: 'upcoming', title: 'New Releases', colors: ['#00C6FF', '#0072FF'] as const, icon: 'calendar' },
  { id: 'top_rated', title: 'Top Rated', colors: ['#F2C94C', '#F2994A'] as const, icon: 'star.fill' },
  { id: '28', title: 'Action', colors: ['#FF416C', '#FF4B2B'] as const, icon: 'bolt.fill' },
  { id: '35', title: 'Comedy', colors: ['#F7971E', '#FFD200'] as const, icon: 'face.smiling.fill' },
  { id: '18', title: 'Drama', colors: ['#8E2DE2', '#4A00E0'] as const, icon: 'theatermasks.fill' },
];

const TV_CATEGORIES = [
  { id: 'trending', title: 'Trending TV', colors: ['#11998e', '#38ef7d'] as const, icon: 'tv.fill' },
  { id: 'airing_today', title: 'Airing Today', colors: ['#FC466B', '#3F5EFB'] as const, icon: 'play.tv.fill' },
  { id: 'top_rated', title: 'Top Rated', colors: ['#FDC830', '#F37335'] as const, icon: 'star.circle.fill' },
  { id: '10765', title: 'Sci-Fi & Fantasy', colors: ['#00F260', '#0575E6'] as const, icon: 'sparkles' },
  { id: '16', title: 'Animation', colors: ['#FF0099', '#493240'] as const, icon: 'paintbrush.fill' },
  { id: '99', title: 'Documentary', colors: ['#20002c', '#cbb4d4'] as const, icon: 'camera.fill' },
];

export default function SearchScreen() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(Movie | TVShow)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login');
    }
  }, [user]);

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      const watchlist = await storageService.getWatchlist();
      const ids = new Set(watchlist.map(item => `${item.type}-${item.id}`));
      setWatchlistIds(ids);
    } catch (error) {
      console.error('Error loading watchlist:', error);
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await tmdbService.searchMulti(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching:', error);
      setError('Failed to fetch search results.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Trigger search when query changes with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearch = () => {
    performSearch(searchQuery);
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    // Refresh watchlist status
    await loadWatchlist();
    // Re-perform current search if there's a query
    if (searchQuery.trim()) {
      await performSearch(searchQuery);
    }
    setIsRefreshing(false);
  };

  const handleItemPress = (item: Movie | TVShow) => {
    const type = 'title' in item ? 'movie' : 'tv';
    router.push(`/details/${type}/${item.id}`);
  };

  const handleWatchlistPress = async (item: Movie | TVShow) => {
    const type = 'title' in item ? 'movie' : 'tv';
    const key = `${type}-${item.id}`;
    const title = 'title' in item ? item.title : item.name;
    const releaseDate = 'title' in item ? item.release_date : item.first_air_date;

    try {
      if (watchlistIds.has(key)) {
        await storageService.removeFromWatchlist(item.id, type);
        setWatchlistIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      } else {
        await storageService.addToWatchlist({
          id: item.id,
          type,
          title,
          poster_path: item.poster_path,
          release_date: type === 'movie' ? releaseDate : undefined,
          first_air_date: type === 'tv' ? releaseDate : undefined,
          vote_average: item.vote_average,
        });
        setWatchlistIds(prev => new Set([...prev, key]));
      }
    } catch (error) {
      console.error('Error updating watchlist:', error);
    }
  };

  const isInWatchlist = (id: number, type: 'movie' | 'tv') => {
    return watchlistIds.has(`${type}-${id}`);
  };

  const renderItem = ({ item }: { item: Movie | TVShow }) => {
    const type = 'title' in item ? 'movie' : 'tv';
    return (
      <View style={styles.cardContainer}>
        <MediaCard
          item={item}
          type={type}
          onPress={() => handleItemPress(item)}
          onWatchlistPress={() => handleWatchlistPress(item)}
          isInWatchlist={isInWatchlist(item.id, type)}
        />
      </View>
    );
  };

  const renderCategory = ({ item, type }: { item: { id: string; title: string; colors: readonly string[] | string[]; icon: string }, type: 'movie' | 'tv' }) => (
    <View style={styles.categoryWrapper}>
      <CategoryCard
        title={item.title}
        gradientColors={item.colors}
        icon={item.icon}
        onPress={() => router.push({
          pathname: '/(tabs)/search/category/[id]',
          params: { id: item.id, title: item.title, type }
        })}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Search',
          headerLargeTitle: true,
          headerSearchBarOptions: {
            placeholder: 'Search for movies & TV shows',
            onChangeText: (event) => {
              setSearchQuery(event.nativeEvent.text);
            },
            onSearchButtonPress: (event) => {
              performSearch(event.nativeEvent.text);
            },
          },
        }}
      />

      {/* Loading state */}
      {loading && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {/* Error state */}
      {error && !loading && (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => performSearch(searchQuery)}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Browse Categories - Show when no search query */}
      {!searchQuery.trim() && !loading && (
        <FlatList
          data={[...MOVIE_CATEGORIES.map(c => ({ ...c, type: 'movie' as const })), ...TV_CATEGORIES.map(c => ({ ...c, type: 'tv' as const }))]}
          renderItem={({ item }) => renderCategory({ item, type: item.type })}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.row}
          contentInsetAdjustmentBehavior="automatic"
        //ListHeaderComponent={
        //<View style={styles.sectionHeader}>
        //  <Text style={styles.sectionTitle}>Browse Categories</Text>
        //</View>
        //}
        />
      )}

      {/* Empty state - no results (only show when searching) */}
      {searchQuery.trim() && searchResults.length === 0 && !loading && !error && (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No results found for &quot;{searchQuery}&quot;</Text>
          <Text style={styles.emptyText}>
            No movies or TV shows found for &quot;{searchQuery}&quot;. Try a different search term.
          </Text>
        </View>
      )}

      {/* Search Results */}
      {searchQuery.trim() && searchResults.length > 0 && !loading && (
        <FlatList
          data={searchResults}
          renderItem={renderItem}
          keyExtractor={(item) => `${('title' in item ? 'movie' : 'tv')}-${item.id}`}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.row}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContainer: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  cardContainer: {
    width: '48%',
    marginBottom: 16,
  },
  categoryWrapper: {
    width: '48%',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
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
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
});