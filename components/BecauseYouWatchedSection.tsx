import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { Movie, TVShow } from '../types';
import { MediaCard } from './MediaCard';
import { SkeletonLoader } from './SkeletonLoader';
import { ErrorState } from './ErrorState';

interface BecauseYouWatchedSectionProps {
  sourceTitle: string;
  items: (Movie | TVShow)[];
  type: 'movie' | 'tv';
  onItemPress: (item: Movie | TVShow, type: 'movie' | 'tv') => void;
  onWatchlistPress: (item: Movie | TVShow, type: 'movie' | 'tv') => void;
  isInWatchlist: (id: number) => boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * BecauseYouWatchedSection Component
 * 
 * Displays personalized recommendations based on a specific watched item.
 * 
 * Requirements:
 * - 5.1: Display section with source title in header
 * - 5.2: Show horizontal scrollable list of recommendations
 * - 5.3: Support loading, error, and empty states
 * - 5.4: Integrate with watchlist actions
 */
export const BecauseYouWatchedSection: React.FC<BecauseYouWatchedSectionProps> = ({
  sourceTitle,
  items,
  type,
  onItemPress,
  onWatchlistPress,
  isInWatchlist,
  loading = false,
  error = null,
  onRetry,
}) => {
  const sectionTitle = `Because You Watched ${sourceTitle}`;

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
        <Text style={styles.title}>{sectionTitle}</Text>
        <SkeletonLoader type="card" count={3} animated />
      </View>
    );
  }

  // Render error state
  if (error && onRetry) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{sectionTitle}</Text>
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
      <Text style={styles.title}>{sectionTitle}</Text>
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
