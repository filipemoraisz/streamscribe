import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MediaCard } from '../../components/MediaCard';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { storageService } from '../../services/storage';
import { WatchlistItem } from '../../types';

export default function WatchlistScreen() {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'movies' | 'tv' | 'watched' | 'unwatched'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login');
    }
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      loadWatchlist();
    }, [])
  );

  const loadWatchlist = async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setIsLoading(true);
      }
      setError(null);
      const items = await storageService.getWatchlist();
      setWatchlist(items.sort((a, b) => new Date(b.added_date).getTime() - new Date(a.added_date).getTime()));
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

  const handleToggleWatched = async (item: WatchlistItem) => {
    try {
      await storageService.toggleWatched(item.id, item.type);
      await loadWatchlist(false);
    } catch (error) {
      console.error('Error toggling watched status:', error);
    }
  };

  const getFilteredWatchlist = () => {
    switch (filter) {
      case 'movies':
        return watchlist.filter(item => item.type === 'movie');
      case 'tv':
        return watchlist.filter(item => item.type === 'tv');
      case 'watched':
        return watchlist.filter(item => item.watched);
      case 'unwatched':
        return watchlist.filter(item => !item.watched);
      default:
        return watchlist;
    }
  };

  const renderFilterButton = (filterType: typeof filter, label: string) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === filterType && styles.filterButtonActive]}
      onPress={() => setFilter(filterType)}
    >
      <Text style={[styles.filterButtonText, filter === filterType && styles.filterButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: WatchlistItem }) => {
    // Convert WatchlistItem to Movie/TVShow format for MediaCard
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

    return (
      <View style={styles.cardContainer}>
        <MediaCard
          item={mediaItem}
          type={item.type}
          onPress={() => handleItemPress(item)}
          onWatchlistPress={() => handleWatchlistPress(item)}
          isInWatchlist={true}
        />
        <TouchableOpacity
          style={[styles.watchedButton, item.watched && styles.watchedButtonActive]}
          onPress={() => handleToggleWatched(item)}
        >
          <Ionicons
            name={item.watched ? "checkmark-circle" : "checkmark-circle-outline"}
            size={20}
            color={item.watched ? Colors.success : Colors.textMuted}
          />
          <Text style={[styles.watchedButtonText, item.watched && styles.watchedButtonTextActive]}>
            {item.watched ? 'Watched' : 'Mark as Watched'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const filteredWatchlist = getFilteredWatchlist();

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your watchlist...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadWatchlist()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filtersContainer}>
        {renderFilterButton('all', 'All')}
        {renderFilterButton('movies', 'Movies')}
        {renderFilterButton('tv', 'TV Shows')}
        {renderFilterButton('unwatched', 'To Watch')}
        {renderFilterButton('watched', 'Watched')}
      </View>

      {filteredWatchlist.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>
            {filter === 'all' ? 'Your watchlist is empty' : `No ${filter === 'movies' ? 'movies' : filter === 'tv' ? 'TV shows' : filter} found`}
          </Text>
          <Text style={styles.emptyText}>
            {filter === 'all'
              ? 'Use the search tab to find and add movies or TV shows to your watchlist'
              : `Try changing the filter or add more ${filter === 'movies' ? 'movies' : filter === 'tv' ? 'TV shows' : 'content'} to your watchlist`
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredWatchlist}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.type}-${item.id}`}
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
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: Colors.text,
    fontWeight: '600',
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
  watchedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: Colors.surface,
  },
  watchedButtonActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  watchedButtonText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 4,
    fontWeight: '500',
  },
  watchedButtonTextActive: {
    color: Colors.success,
    fontWeight: '600',
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
    lineHeight: 24,
  },
});