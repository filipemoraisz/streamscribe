import { Colors } from '@/constants/Colors';
import { progressService } from '@/services/progress';
import { tmdbService } from '@/services/tmdb';
import { Episode, EpisodeProgress, Season } from '@/types';
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
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function SeasonDetailsScreen() {
  const { showId, seasonNumber } = useLocalSearchParams<{ showId: string; seasonNumber: string }>();
  const [season, setSeason] = useState<Season | null>(null);
  const [showPosterPath, setShowPosterPath] = useState<string | null>(null);
  const [episodeProgress, setEpisodeProgress] = useState<EpisodeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (showId && seasonNumber) {
      loadSeasonDetails();
      loadProgress();
    }
  }, [showId, seasonNumber]);

  const loadSeasonDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load both season and show details
      const [seasonData, showData] = await Promise.all([
        tmdbService.getSeasonDetails(
          parseInt(showId as string),
          parseInt(seasonNumber as string)
        ),
        tmdbService.getTVShowDetails(parseInt(showId as string))
      ]);
      
      setSeason(seasonData);
      setShowPosterPath(showData.poster_path || null);
    } catch (error) {
      console.error('Error loading season details:', error);
      setError('Failed to load season details. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    try {
      const progress = await progressService.getEpisodeProgress(parseInt(showId as string));
      setEpisodeProgress(progress);
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const handleEpisodePress = (episode: Episode) => {
    router.push(`/episode/${showId}/${seasonNumber}/${episode.episode_number}`);
  };

  const isEpisodeWatched = (episode: Episode): boolean => {
    return episodeProgress.some(
      ep => ep.season_number === episode.season_number &&
        ep.episode_number === episode.episode_number &&
        ep.watched
    );
  };

  const toggleEpisodeWatched = async (episode: Episode) => {
    try {
      const isWatched = isEpisodeWatched(episode);

      if (!isWatched) {
        // Check for future episodes
        if (episode.air_date) {
          const airDate = new Date(episode.air_date);
          const now = new Date();
          // Reset time part for accurate date comparison
          airDate.setHours(0, 0, 0, 0);
          now.setHours(0, 0, 0, 0);

          if (airDate > now) {
            Alert.alert("Oops...", "Nice try but you'll need to wait for this!");
            return;
          }
        }
      }

      if (isWatched) {
        await progressService.markEpisodeUnwatched(
          parseInt(showId as string),
          episode.season_number,
          episode.episode_number
        );
      } else {
        await progressService.markEpisodeWatched(
          parseInt(showId as string),
          episode.season_number,
          episode.episode_number
        );
      }

      await loadProgress();
    } catch (error) {
      console.error('Error toggling episode watched:', error);
      Alert.alert('Error', 'Failed to update episode status');
    }
  };

  const getWatchedCount = (): number => {
    if (!season?.episodes) return 0;
    return season.episodes.filter(ep => isEpisodeWatched(ep)).length;
  };

  const markAllWatched = async () => {
    if (!season?.episodes) return;

    Alert.alert(
      'Mark All Watched',
      `Mark all ${season.episodes.length} episodes as watched?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All',
          onPress: async () => {
            try {
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              let skippedCount = 0;
              const episodesToMark: number[] = [];

              for (const episode of season.episodes!) {
                if (!isEpisodeWatched(episode)) {
                  // Check air date
                  if (episode.air_date) {
                    const airDate = new Date(episode.air_date);
                    airDate.setHours(0, 0, 0, 0);
                    if (airDate > now) {
                      skippedCount++;
                      continue;
                    }
                  }
                  episodesToMark.push(episode.episode_number);
                }
              }

              if (episodesToMark.length > 0) {
                await progressService.markEpisodesBatch(
                  parseInt(showId as string),
                  parseInt(seasonNumber as string),
                  episodesToMark
                );
                await loadProgress();
              }

              if (skippedCount > 0) {
                Alert.alert('Note', `Marked available episodes as watched. Skipped ${skippedCount} un-aired episodes.`);
              }
            } catch (error) {
              console.error('Error marking all watched:', error);
              Alert.alert('Error', 'Failed to mark all episodes as watched');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading season details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadSeasonDetails}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!season) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Season not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const watchedCount = getWatchedCount();
  const totalCount = season.episodes?.length || 0;
  const progressPercentage = totalCount > 0 ? (watchedCount / totalCount) * 100 : 0;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: season.name,
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.posterContainer}>
            {season.poster_path ? (
              <Image
                source={{ uri: tmdbService.getImageURL(season.poster_path, 'w500') || '' }}
                style={styles.poster}
              />
            ) : (
              <View style={styles.placeholderPoster}>
                <Ionicons name="tv-outline" size={40} color={Colors.textMuted} />
              </View>
            )}
          </View>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>{season.name}</Text>
            <Text style={styles.episodeCount}>{season.episode_count} Episodes</Text>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {watchedCount}/{totalCount} watched ({Math.round(progressPercentage)}%)
              </Text>
            </View>

            <TouchableOpacity style={styles.markAllButton} onPress={markAllWatched}>
              <Ionicons name="checkmark-done" size={20} color={Colors.primary} />
              <Text style={styles.markAllText}>Mark All Watched</Text>
            </TouchableOpacity>
          </View>
        </View>

        {season.overview && (
          <View style={styles.overview}>
            <Text style={styles.overviewTitle}>Overview</Text>
            <Text style={styles.overviewText}>{season.overview}</Text>
          </View>
        )}

        <View style={styles.episodesSection}>
          <Text style={styles.episodesTitle}>Episodes</Text>
          {season.episodes?.map((episode) => (
            <TouchableOpacity
              key={episode.id}
              style={styles.episodeCard}
              onPress={() => handleEpisodePress(episode)}
            >
              <View style={styles.episodeImageContainer}>
                {episode.still_path || showPosterPath ? (
                  <Image
                    source={{ 
                      uri: tmdbService.getImageURL(
                        episode.still_path || showPosterPath!, 
                        'w300'
                      ) || '' 
                    }}
                    style={styles.episodeImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.placeholderEpisodeImage}>
                    <Ionicons name="play-outline" size={24} color={Colors.textMuted} />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.watchedButton}
                  onPress={() => toggleEpisodeWatched(episode)}
                >
                  <Ionicons
                    name={isEpisodeWatched(episode) ? "checkmark-circle" : "checkmark-circle-outline"}
                    size={24}
                    color={isEpisodeWatched(episode) ? Colors.success : Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.episodeInfo}>
                <Text style={styles.episodeTitle}>
                  {episode.episode_number}. {episode.name}
                </Text>
                <Text style={styles.episodeOverview} numberOfLines={3}>
                  {episode.overview}
                </Text>
                <View style={styles.episodeDetails}>
                  <Text style={styles.episodeDate}>
                    {episode.air_date ? new Date(episode.air_date).toLocaleDateString() : 'TBA'}
                  </Text>
                  {episode.runtime > 0 && (
                    <Text style={styles.episodeRuntime}>{episode.runtime} min</Text>
                  )}
                  {episode.vote_average > 0 && (
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={12} color={Colors.primary} />
                      <Text style={styles.rating}>{episode.vote_average.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
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
  header: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 16,
  },
  posterContainer: {
    marginRight: 16,
  },
  poster: {
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  placeholderPoster: {
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  episodeCount: {
    fontSize: 16,
    color: Colors.textMuted,
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  markAllText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  overview: {
    paddingHorizontal: 16,
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
  episodesSection: {
    paddingHorizontal: 16,
  },
  episodesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  episodeCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  episodeImageContainer: {
    position: 'relative',
  },
  episodeImage: {
    width: 100,
    height: 140,
    backgroundColor: Colors.card,
  },
  placeholderEpisodeImage: {
    width: 100,
    height: 140,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  watchedButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 4,
  },
  episodeInfo: {
    flex: 1,
    padding: 12,
  },
  episodeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  episodeOverview: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  episodeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  episodeDate: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  episodeRuntime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 2,
  },
});