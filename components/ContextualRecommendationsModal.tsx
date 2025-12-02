import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { tmdbService } from '../services/tmdb';
import { storageService } from '../services/storage';
import { MediaCard } from './MediaCard';
import { Movie, TVShow } from '../types';

const { width } = Dimensions.get('window');

interface ContextualRecommendationsModalProps {
  visible: boolean;
  onClose: () => void;
  genreIds: number[];
  mood: string;
  message: string;
}

export function ContextualRecommendationsModal({
  visible,
  onClose,
  genreIds,
  mood,
  message,
}: ContextualRecommendationsModalProps) {
  const [recommendations, setRecommendations] = useState<(Movie | TVShow)[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadRecommendations();
    }
  }, [visible, genreIds]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      // Get user's watchlist to filter out
      const watchlist = await storageService.getWatchlist();
      const watchlistIds = new Set(
        watchlist.map(item => `${item.type}-${item.id}`)
      );

      // Fetch trending content as recommendations
      const [movies, tvShows] = await Promise.all([
        tmdbService.getTrendingMovies(),
        tmdbService.getTrendingTVShows(),
      ]);

      // Filter out items already in watchlist
      const filteredMovies = movies.filter(
        movie => !watchlistIds.has(`movie-${movie.id}`)
      );
      const filteredTVShows = tvShows.filter(
        show => !watchlistIds.has(`tv-${show.id}`)
      );

      // Mix movies and TV shows
      const mixed = [...filteredMovies.slice(0, 6), ...filteredTVShows.slice(0, 6)]
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);

      setRecommendations(mixed);
    } catch (error) {
      console.error('Error loading contextual recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMoodEmoji = () => {
    switch (mood) {
      case 'cozy': return '🔥';
      case 'energetic': return '⚡';
      case 'fun': return '🎉';
      case 'relaxing': return '🌙';
      case 'intense': return '🎯';
      case 'thoughtful': return '🤔';
      default: return '✨';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.moodEmoji}>{getMoodEmoji()}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.title}>Perfect For Right Now</Text>
            <Text style={styles.subtitle}>{message}</Text>
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>Finding perfect matches...</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {recommendations.map((item) => (
                  <View key={`${item.id}-${'title' in item ? 'movie' : 'tv'}`} style={styles.cardWrapper}>
                    <MediaCard
                      item={item}
                      type={'title' in item ? 'movie' : 'tv'}
                      onPress={() => {
                        // Handle navigation to detail screen
                        onClose();
                      }}
                      onWatchlistPress={() => {}}
                      isInWatchlist={false}
                    />
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  moodEmoji: {
    fontSize: 32,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
  content: {
    flex: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  cardWrapper: {
    width: (width - 56) / 2, // 2 columns with padding and gap
  },
});
