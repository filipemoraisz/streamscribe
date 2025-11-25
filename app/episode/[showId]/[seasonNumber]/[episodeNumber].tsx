import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Colors } from '../../../../constants/Colors';
import { progressService } from '../../../../services/progress';
import { tmdbService } from '../../../../services/tmdb';
import { Episode } from '../../../../types';

const { width } = Dimensions.get('window');

export default function EpisodeDetailsScreen() {
  const { showId, seasonNumber, episodeNumber } = useLocalSearchParams<{
    showId: string;
    seasonNumber: string;
    episodeNumber: string;
  }>();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [isWatched, setIsWatched] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (showId && seasonNumber && episodeNumber) {
      loadEpisodeDetails();
      checkWatchedStatus();
    }
  }, [showId, seasonNumber, episodeNumber]);

  const loadEpisodeDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const episodeData = await tmdbService.getEpisodeDetails(
        parseInt(showId as string),
        parseInt(seasonNumber as string),
        parseInt(episodeNumber as string)
      );
      setEpisode(episodeData);
    } catch (error) {
      console.error('Error loading episode details:', error);
      setError('Failed to load episode details. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkWatchedStatus = async () => {
    try {
      const watched = await progressService.isEpisodeWatched(
        parseInt(showId as string),
        parseInt(seasonNumber as string),
        parseInt(episodeNumber as string)
      );
      setIsWatched(watched);

      // Get user rating if episode is watched
      if (watched) {
        const progress = await progressService.getEpisodeProgress(parseInt(showId as string));
        const episodeProgress = progress.find(
          ep => ep.season_number === parseInt(seasonNumber as string) &&
            ep.episode_number === parseInt(episodeNumber as string)
        );
        setUserRating(episodeProgress?.rating || null);
      }
    } catch (error) {
      console.error('Error checking watched status:', error);
    }
  };

  const toggleWatched = async () => {
    try {
      if (isWatched) {
        await progressService.markEpisodeUnwatched(
          parseInt(showId as string),
          parseInt(seasonNumber as string),
          parseInt(episodeNumber as string)
        );
        setIsWatched(false);
        setUserRating(null);
      } else {
        await progressService.markEpisodeWatched(
          parseInt(showId as string),
          parseInt(seasonNumber as string),
          parseInt(episodeNumber as string),
          userRating || undefined
        );
        setIsWatched(true);
      }
    } catch (error) {
      console.error('Error toggling watched status:', error);
      Alert.alert('Error', 'Failed to update episode status');
    }
  };

  const handleRating = (rating: number) => {
    Alert.alert(
      'Rate Episode',
      `Rate this episode ${rating}/10?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rate',
          onPress: async () => {
            try {
              setUserRating(rating);
              await progressService.markEpisodeWatched(
                parseInt(showId as string),
                parseInt(seasonNumber as string),
                parseInt(episodeNumber as string),
                rating
              );
              setIsWatched(true);
            } catch (error) {
              console.error('Error rating episode:', error);
              Alert.alert('Error', 'Failed to rate episode');
            }
          },
        },
      ]
    );
  };

  const navigateToSeason = () => {
    router.push(`/season/${showId}/${seasonNumber}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading episode details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadEpisodeDetails}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!episode) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Episode not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `S${seasonNumber}E${episodeNumber}`,
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView style={styles.scrollView}>
        <View style={styles.imageContainer}>
          {episode.still_path ? (
            <Image
              source={{ uri: tmdbService.getImageURL(episode.still_path, 'w1280') || '' }}
              style={styles.stillImage}
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="play-outline" size={64} color={Colors.textMuted} />
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.episodeNumber}>
              Episode {episode.episode_number}
            </Text>
            <Text style={styles.title}>{episode.name}</Text>

            <View style={styles.metadata}>
              <Text style={styles.airDate}>
                {episode.air_date ? new Date(episode.air_date).toLocaleDateString() : 'TBA'}
              </Text>
              {episode.runtime > 0 && (
                <Text style={styles.runtime}>{episode.runtime} minutes</Text>
              )}
              {episode.vote_average > 0 && (
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={16} color={Colors.primary} />
                  <Text style={styles.rating}>
                    {episode.vote_average.toFixed(1)} ({episode.vote_count} votes)
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.watchedButton, isWatched && styles.watchedButtonActive]}
                onPress={toggleWatched}
              >
                <Ionicons
                  name={isWatched ? "checkmark-circle" : "checkmark-circle-outline"}
                  size={20}
                  color={Colors.text}
                />
                <Text style={styles.watchedButtonText}>
                  {isWatched ? 'Watched' : 'Mark as Watched'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.seasonButton} onPress={navigateToSeason}>
                <Ionicons name="list-outline" size={20} color={Colors.text} />
                <Text style={styles.seasonButtonText}>View Season</Text>
              </TouchableOpacity>
            </View>
          </View>

          {episode.overview && (
            <View style={styles.overview}>
              <Text style={styles.overviewTitle}>Overview</Text>
              <Text style={styles.overviewText}>{episode.overview}</Text>
            </View>
          )}

          <View style={styles.ratingSection}>
            <Text style={styles.ratingSectionTitle}>Your Rating</Text>
            {userRating ? (
              <View style={styles.userRatingContainer}>
                <Text style={styles.userRatingText}>You rated this episode:</Text>
                <View style={styles.userRatingStars}>
                  {[...Array(10)].map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleRating(index + 1)}
                    >
                      <Ionicons
                        name={index < userRating ? "star" : "star-outline"}
                        size={24}
                        color={index < userRating ? Colors.primary : Colors.textMuted}
                        style={styles.ratingStar}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.userRatingValue}>{userRating}/10</Text>
              </View>
            ) : (
              <View style={styles.ratingStars}>
                <Text style={styles.ratingPrompt}>Rate this episode:</Text>
                <View style={styles.starsContainer}>
                  {[...Array(10)].map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleRating(index + 1)}
                    >
                      <Ionicons
                        name="star-outline"
                        size={24}
                        color={Colors.textMuted}
                        style={styles.ratingStar}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: width,
    height: width * 0.56,
    backgroundColor: Colors.surface,
  },
  stillImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  episodeNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  metadata: {
    marginBottom: 16,
  },
  airDate: {
    fontSize: 16,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  runtime: {
    fontSize: 16,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rating: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  watchedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  watchedButtonActive: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  watchedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
  },
  seasonButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  seasonButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
  },
  overview: {
    marginBottom: 24,
  },
  overviewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  overviewText: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textSecondary,
  },
  ratingSection: {
    marginBottom: 24,
  },
  ratingSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  userRatingContainer: {
    alignItems: 'center',
  },
  userRatingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  userRatingStars: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  userRatingValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  ratingStars: {
    alignItems: 'center',
  },
  ratingPrompt: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
  },
  ratingStar: {
    marginHorizontal: 2,
  },
});