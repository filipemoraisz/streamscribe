import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useCallback } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { tmdbService } from '../services/tmdb';
import { ContinueWatchingItem } from '../services/continueWatching';
import { ErrorState } from './ErrorState';
import { SkeletonLoader } from './SkeletonLoader';

interface ContinueWatchingSectionProps {
  items: ContinueWatchingItem[];
  onItemPress: (item: ContinueWatchingItem) => void;
  onRemove: (id: number, type: 'movie' | 'tv') => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  activeFilter?: 'all' | 'movie' | 'tv';
}

export const ContinueWatchingSection = React.memo<ContinueWatchingSectionProps>(({
  items,
  onItemPress,
  onRemove,
  loading = false,
  error = null,
  onRetry,
  activeFilter = 'all',
}) => {
  // Memoize filtered items to prevent unnecessary recalculations
  const filteredItems = useMemo(() => {
    return activeFilter === 'all' 
      ? items 
      : items.filter(item => item.type === activeFilter);
  }, [items, activeFilter]);

  // Memoize render function to prevent recreating on every render
  const renderItem = useCallback(({ item }: { item: ContinueWatchingItem }) => {
    const posterUrl = tmdbService.getImageURL(item.poster_path, 'w500');
    const title = item.title;

    // DEBUG: Log each item being rendered
    console.log(`[ContinueWatchingSection] 🎬 Rendering item:`, {
      id: item.id,
      type: item.type,
      title: item.title,
      nextEpisode: item.nextEpisode ? `S${item.nextEpisode.season}E${item.nextEpisode.episode}` : 'N/A',
      progress: `${item.progress}%`,
      lastWatched: item.lastWatchedAt,
    });

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.imageContainer}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.poster} />
          ) : (
            <View style={styles.placeholderPoster}>
              <Ionicons name="image-outline" size={40} color={Colors.textMuted} />
            </View>
          )}
          
          {/* Remove button */}
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => onRemove(item.id, item.type)}
          >
            <Ionicons name="close-circle" size={24} color={Colors.text} />
          </TouchableOpacity>

          {/* Progress bar overlay */}
          <View style={styles.progressOverlay}>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${item.progress}%` },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          
          {/* Next episode info for TV shows */}
          {item.type === 'tv' && item.nextEpisode && (
            <View style={styles.episodeInfo}>
              <Ionicons name="play-circle-outline" size={14} color={Colors.primary} />
              <Text style={styles.episodeText}>
                S{item.nextEpisode.season} E{item.nextEpisode.episode}
              </Text>
            </View>
          )}

          {/* Progress percentage */}
          <Text style={styles.progressText}>
            {item.progress}% complete
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [onItemPress, onRemove]);

  // Memoize key extractor
  const keyExtractor = useCallback((item: ContinueWatchingItem) => `${item.type}-${item.id}`, []);

  // Render loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Continue Watching</Text>
        <SkeletonLoader type="card" count={3} animated />
      </View>
    );
  }

  // Render error state
  if (error && onRetry) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Continue Watching</Text>
        <ErrorState message={error} onRetry={onRetry} />
      </View>
    );
  }

  // Don't render if no items (hide section when empty)
  if (filteredItems.length === 0) {
    return null;
  }

  // Render content
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Continue Watching</Text>
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        windowSize={5}
      />
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function - only re-render if these actually change
  return (
    prevProps.loading === nextProps.loading &&
    prevProps.error === nextProps.error &&
    prevProps.activeFilter === nextProps.activeFilter &&
    prevProps.items.length === nextProps.items.length &&
    // Deep compare items by checking if any item's key properties changed
    prevProps.items.every((item, index) => {
      const nextItem = nextProps.items[index];
      return nextItem && 
        item.id === nextItem.id &&
        item.progress === nextItem.progress &&
        item.nextEpisode?.season === nextItem.nextEpisode?.season &&
        item.nextEpisode?.episode === nextItem.nextEpisode?.episode;
    })
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionTitle: {
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
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 2 / 3,
  },
  poster: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  placeholderPoster: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  info: {
    paddingTop: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  episodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  episodeText: {
    fontSize: 12,
    color: Colors.primary,
    marginLeft: 4,
    fontWeight: '600',
  },
  progressText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
