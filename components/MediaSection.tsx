import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { Movie, TVShow, WatchlistItem } from '../types';
import { MediaCard } from './MediaCard';

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
}) => {
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