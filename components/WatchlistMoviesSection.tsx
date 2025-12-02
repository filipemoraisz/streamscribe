import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MediaCard } from './MediaCard';
import { Colors } from '../constants/Colors';
import { WatchlistItem } from '../types';

interface WatchlistMoviesSectionProps {
  movies: WatchlistItem[];
  onItemPress: (item: WatchlistItem) => void;
  onWatchlistPress: (item: WatchlistItem) => void;
  onMovieActionPress?: (item: WatchlistItem) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function WatchlistMoviesSection({
  movies,
  onItemPress,
  onWatchlistPress,
  onMovieActionPress,
  loading = false,
  error = null,
  onRetry,
}: WatchlistMoviesSectionProps) {
  // Don't render if no movies and not loading
  if (!loading && movies.length === 0 && !error) {
    return null;
  }

  const renderItem = ({ item }: { item: WatchlistItem }) => {
    const mediaItem = {
      id: item.id,
      title: item.title,
      name: item.title,
      poster_path: item.poster_path,
      release_date: item.release_date || '',
      vote_average: item.vote_average,
      overview: '',
      backdrop_path: null,
      vote_count: 0,
      genre_ids: [],
      adult: false,
      original_language: '',
      original_title: item.title,
      popularity: 0,
      video: false,
    };

    return (
      <View style={styles.cardWrapper}>
        <MediaCard
          item={mediaItem}
          type="movie"
          onPress={() => onItemPress(item)}
          onWatchlistPress={() => onWatchlistPress(item)}
          isInWatchlist={true}
          onMovieActionPress={onMovieActionPress ? () => onMovieActionPress(item) : undefined}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Movies From Your Watchlist</Text>
        <TouchableOpacity
          style={styles.seeAllButton}
          onPress={() => {
            // Navigate to watchlist and set filter to movies via state
            router.push({
              pathname: '/(tabs)/watchlist',
              params: { filter: 'movies' }
            } as any);
          }}
        >
          <Text style={styles.seeAllText}>See All</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          {onRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={movies}
          renderItem={renderItem}
          keyExtractor={(item) => `movie-${item.id}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  cardWrapper: {
    width: 140,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
