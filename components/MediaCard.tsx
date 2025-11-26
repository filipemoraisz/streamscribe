import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Colors } from '../constants/Colors';
import { tmdbService } from '../services/tmdb';
import { Movie, TVShow } from '../types';

interface MediaCardProps {
  item: Movie | TVShow;
  type: 'movie' | 'tv';
  onPress: () => void;
  onWatchlistPress: () => void;
  isInWatchlist: boolean;
  style?: StyleProp<ViewStyle>;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  type,
  onPress,
  onWatchlistPress,
  isInWatchlist,
  style,
}) => {
  const title = type === 'movie' ? (item as Movie).title : (item as TVShow).name;
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
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
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
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
    lineHeight: 20,
    height: 40, // 2 lines * 20 lineHeight
  },
  year: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
});