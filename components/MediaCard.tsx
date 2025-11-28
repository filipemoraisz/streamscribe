import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Colors } from '../constants/Colors';
import { tmdbService } from '../services/tmdb';
import { Movie, TVShow } from '../types';
import { WatchlistActionButton } from './WatchlistActionButton';

interface MediaCardProps {
  item: Movie | TVShow;
  type: 'movie' | 'tv';
  onPress: () => void;
  onWatchlistPress: () => void;
  onNextEpisodePress?: () => void;
  onMovieActionPress?: () => void;
  isInWatchlist: boolean;
  nextEpisode?: { season: number; episode: number };
  style?: StyleProp<ViewStyle>;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  type,
  onPress,
  onWatchlistPress,
  onNextEpisodePress,
  onMovieActionPress,
  isInWatchlist,
  nextEpisode,
  style,
}) => {
  const title = 'title' in item ? item.title : (item as TVShow).name;
  const releaseDate = type === 'movie' ? (item as Movie).release_date : (item as TVShow).first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : '';
  const posterUrl = tmdbService.getImageURL(item.poster_path, 'w500');

  return (
    <TouchableOpacity style={[styles.container, style]} onPress={onPress}>
      <View style={styles.imageContainer}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} />
        ) : (
          <View style={styles.placeholderPoster}>
            <Ionicons name="image-outline" size={40} color={Colors.textMuted} />
          </View>
        )}
        <TouchableOpacity
          style={styles.watchlistButton}
          onPress={onWatchlistPress}
        >
          <Ionicons
            name={isInWatchlist ? "bookmark" : "bookmark-outline"}
            size={20}
            color={isInWatchlist ? Colors.primary : Colors.text}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {type === 'tv' && nextEpisode && onNextEpisodePress && (
            <WatchlistActionButton
              onPress={onNextEpisodePress}
              label={`S${nextEpisode.season} E${nextEpisode.episode}`}
              style={styles.indicator}
            />
          )}
          {type === 'movie' && isInWatchlist && onMovieActionPress && (
            <WatchlistActionButton
              onPress={onMovieActionPress}
              style={styles.indicator}
              icon="eye"
            />
          )}
        </View>
        <Text style={styles.year}>{year}</Text>
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={12} color={Colors.primary} />
          <Text style={styles.rating}>
            {item.vote_average.toFixed(1)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    // Removed fixed width and margin
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 2 / 3, // Standard poster ratio
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
  watchlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  info: {
    paddingTop: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    height: 40,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF', // Explicitly white
    lineHeight: 20,
    marginRight: 4,
  },
  indicator: {
    marginTop: 2, // Align with text
  },
  year: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
});