import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { Movie, TVShow, WatchlistItem } from '../types';
import { MediaCard } from './MediaCard';
import { SkeletonLoader } from './SkeletonLoader';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';

interface MediaSectionProps {
  title: string;
  data: (Movie | TVShow | WatchlistItem)[];
  type: 'movie' | 'tv';
  onItemPress: (item: Movie | TVShow) => void;
  onWatchlistPress: (item: Movie | TVShow) => void;
  isInWatchlist: (id: number) => boolean;
  nextEpisodes?: Record<number, { season: number; episode: number }>;
  onNextEpisodePress?: (item: TVShow, season: number, episode: number) => void;
  onMovieActionPress?: (item: Movie) => void;
  // New props for enhanced functionality
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  filterType?: 'all' | 'movie' | 'tv';
  activeFilter?: 'all' | 'movie' | 'tv';
}

export const MediaSection: React.FC<MediaSectionProps> = ({
  title,
  data,
  type,
  onItemPress,
  onWatchlistPress,
  isInWatchlist,
  nextEpisodes,
  onNextEpisodePress,
  onMovieActionPress,
  loading = false,
  error = null,
  onRetry,
  emptyMessage,
  filterType = 'all',
  activeFilter = 'all',
}) => {
  // Filter logic: hide section if filterType doesn't match activeFilter
  const shouldHideSection = () => {
    if (activeFilter === 'all') return false;
    if (filterType === 'all') return false;
    return filterType !== activeFilter;
  };

  // Don't render if section should be hidden based on filter
  if (shouldHideSection()) {
    return null;
  }

  const renderItem = ({ item }: { item: Movie | TVShow | WatchlistItem }) => {
    // Determine the type of the item safely
    let itemType = type;
    if ('type' in item) {
      itemType = item.type as 'movie' | 'tv';
    }

    const nextEpisode = itemType === 'tv' && nextEpisodes ? nextEpisodes[item.id] : undefined;

    return (
      <MediaCard
        item={item as Movie | TVShow}
        type={itemType}
        onPress={() => onItemPress(item as Movie | TVShow)}
        onWatchlistPress={() => onWatchlistPress(item as Movie | TVShow)}
        isInWatchlist={isInWatchlist(item.id)}
        nextEpisode={nextEpisode}
        onNextEpisodePress={
          nextEpisode && onNextEpisodePress
            ? () => onNextEpisodePress(item as TVShow, nextEpisode.season, nextEpisode.episode)
            : undefined
        }
        onMovieActionPress={
          itemType === 'movie' && onMovieActionPress
            ? () => onMovieActionPress(item as Movie)
            : undefined
        }
        style={styles.card}
      />
    );
  };

  // Render loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <SkeletonLoader type="card" count={3} animated />
      </View>
    );
  }

  // Render error state
  if (error && onRetry) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <ErrorState message={error} onRetry={onRetry} />
      </View>
    );
  }

  // Render empty state
  if (data.length === 0 && emptyMessage) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <EmptyState
          type="section"
          title="No Content"
          message={emptyMessage}
          icon="film-outline"
        />
      </View>
    );
  }

  // Render content
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        data={data}
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