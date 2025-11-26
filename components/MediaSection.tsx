import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { Movie, TVShow } from '../types';
import { MediaCard } from './MediaCard';

interface MediaSectionProps {
  title: string;
  data: (Movie | TVShow)[];
  type: 'movie' | 'tv';
  onItemPress: (item: Movie | TVShow) => void;
  onWatchlistPress: (item: Movie | TVShow) => void;
  isInWatchlist: (id: number) => boolean;
}

export const MediaSection: React.FC<MediaSectionProps> = ({
  title,
  data,
  type,
  onItemPress,
  onWatchlistPress,
  isInWatchlist,
}) => {
  const renderItem = ({ item }: { item: Movie | TVShow }) => (
    <MediaCard
      item={item}
      type={type}
      onPress={() => onItemPress(item)}
      onWatchlistPress={() => onWatchlistPress(item)}
      isInWatchlist={isInWatchlist(item.id)}
      style={styles.card}
    />
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => `${type}-${item.id}`}
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