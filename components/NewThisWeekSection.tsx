import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { Movie, TVShow } from '../types';
import { MediaCard } from './MediaCard';
import { SkeletonLoader } from './SkeletonLoader';
import { ErrorState } from './ErrorState';

interface NewThisWeekSectionProps {
  items: (Movie | TVShow)[];
  onItemPress: (item: Movie | TVShow, type: 'movie' | 'tv') => void;
  onWatchlistPress: (item: Movie | TVShow, type: 'movie' | 'tv') => void;
  isInWatchlist: (id: number) => boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * NewThisWeekSection Component
 * 
 * Displays recently released content (within the last 7 days) with release dates prominently shown.
 * 
 * Requirements:
 * - 9.1: Display "New This Week" section on home screen
 * - 9.2: Include content released within the last 7 days
 * - 9.3: Show both movies and TV shows
 * - 9.4: Order by release date descending (most recent first)
 * - 9.5: Hide section when no new content available
 */
export const NewThisWeekSection: React.FC<NewThisWeekSectionProps> = ({
  items,
  onItemPress,
  onWatchlistPress,
  isInWatchlist,
  loading = false,
  error = null,
  onRetry,
}) => {
  /**
   * Determine the type of content (movie or tv) based on properties
   */
  const getItemType = (item: Movie | TVShow): 'movie' | 'tv' => {
    return 'release_date' in item ? 'movie' : 'tv';
  };

  /**
   * Get release date string from either Movie or TVShow
   */
  const getReleaseDateString = (item: Movie | TVShow): string => {
    if ('release_date' in item) {
      return item.release_date || '';
    } else if ('first_air_date' in item) {
      return item.first_air_date || '';
    }
    return '';
  };

  /**
   * Format release date for display (e.g., "Dec 1, 2025")
   */
  const formatReleaseDate = (dateString: string): string => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const options: Intl.DateTimeFormatOptions = { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      return dateString;
    }
  };

  const renderItem = ({ item }: { item: Movie | TVShow }) => {
    const type = getItemType(item);
    const releaseDate = getReleaseDateString(item);
    const formattedDate = formatReleaseDate(releaseDate);

    return (
      <View style={styles.cardWrapper}>
        <MediaCard
          item={item}
          type={type}
          onPress={() => onItemPress(item, type)}
          onWatchlistPress={() => onWatchlistPress(item, type)}
          isInWatchlist={isInWatchlist(item.id)}
          style={styles.card}
        />
        {/* Display release date prominently below the card */}
        {formattedDate && (
          <View style={styles.dateContainer}>
            <Text style={styles.dateLabel}>Released</Text>
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>
        )}
      </View>
    );
  };

  // Render loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>New This Week</Text>
        <SkeletonLoader type="card" count={3} animated />
      </View>
    );
  }

  // Render error state
  if (error && onRetry) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>New This Week</Text>
        <ErrorState message={error} onRetry={onRetry} />
      </View>
    );
  }

  // Requirement 9.5: Hide section when no new content available
  if (items.length === 0) {
    return null;
  }

  // Render content
  return (
    <View style={styles.container}>
      <Text style={styles.title}>New This Week</Text>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => `${getItemType(item)}-${item.id}`}
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
  cardWrapper: {
    marginRight: 12,
  },
  card: {
    width: 140,
  },
  dateContainer: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  dateLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
});
