import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { Movie, TVShow } from '../types';
import { MediaCard } from './MediaCard';
import { SkeletonLoader } from './SkeletonLoader';
import { ErrorState } from './ErrorState';

interface GenreSectionProps {
  genreName: string;
  items: (Movie | TVShow)[];
  type: 'movie' | 'tv';
  onItemPress: (item: Movie | TVShow, type: 'movie' | 'tv') => void;
  onWatchlistPress: (item: Movie | TVShow, type: 'movie' | 'tv') => void;
  isInWatchlist: (id: number) => boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  activeFilter?: 'all' | 'movie' | 'tv';
}

/**
 * GenreSection Component
 * 
 * Displays content filtered by genre with clear genre name labels.
 * 
 * Requirements:
 * - 6.1: Display section with genre name in header
 * - 6.3: Show horizontal scrollable list of genre-specific content
 * - 6.5: Support loading, error, and empty states
 * - Integrate with watchlist actions
 */
export const GenreSection: React.FC<GenreSectionProps> = ({
  genreName,
  items,
  type,
  onItemPress,
  onWatchlistPress,
  isInWatchlist,
  loading = false,
  error = null,
  onRetry,
  activeFilter = 'all',
}) => {
  // Hide section if filter doesn't match
  if (activeFilter !== 'all' && activeFilter !== type) {
    return null;
  }
  const renderItem = ({ item }: { item: Movie | TVShow }) => {
    return (
      <MediaCard
        item={item}
        type={type}
        onPress={() => onItemPress(item, type)}
        onWatchlistPress={() => onWatchlistPress(item, type)}
        isInWatchlist={isInWatchlist(item.id)}
        style={styles.card}
      />
    );
  };

  // Render loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{genreName}</Text>
        <SkeletonLoader type="card" count={3} animated />
      </View>
    );
  }

  // Render error state
  if (error && onRetry) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{genreName}</Text>
        <ErrorState message={error} onRetry={onRetry} />
      </View>
    );
  }

  // Don't render if no items (hide section when empty)
  if (items.length === 0) {
    return null;
  }

  // Render content
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{genreName}</Text>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  card: {
    width: 140,
    marginRight: 12,
  },
});
