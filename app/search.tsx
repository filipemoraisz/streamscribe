import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MediaCard } from '../components/MediaCard';
import { SearchBar } from '../components/SearchBar';
import { Colors } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { storageService } from '../services/storage';
import { tmdbService } from '../services/tmdb';
import { Movie, TVShow } from '../types';

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

  return (
    <SafeAreaView style={styles.container}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmit={handleSearch}
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

      {/* Empty state - no search query */}
      {!searchQuery.trim() && !loading && (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>Search for Movies & TV Shows</Text>
          <Text style={styles.emptyText}>
            Enter a title, actor, or keyword to find content
          </Text>
        </View>
      )}

      {/* Empty state - no results */}
      {searchQuery.trim() && searchResults.length === 0 && !loading && !error && (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>No Results Found</Text>
          <Text style={styles.emptyText}>
            No movies or TV shows found for "{searchQuery}". Try a different search term.
          </Text>
        </View>
      )}

      {/* Results */}
      {searchResults.length > 0 && !loading && (
        <FlatList
          data={searchResults}
          renderItem={renderItem}
          keyExtractor={(item) => `${('title' in item ? 'movie' : 'tv')}-${item.id}`}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.row}
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
    </SafeAreaView>
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