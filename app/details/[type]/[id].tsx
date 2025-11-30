import { StreamingOptions } from '@/components/StreamingOptions';
import { Colors } from '@/constants/Colors';
import { progressService } from '@/services/progress';
import { storageService } from '@/services/storage';
import { tmdbService } from '@/services/tmdb';
import { Movie, ShowProgress, StreamingOption, TVShow, TVShowDetails } from '@/types';
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

export default function DetailsScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const [item, setItem] = useState<Movie | TVShow | TVShowDetails | null>(null);
  const [streamingOptions, setStreamingOptions] = useState<StreamingOption[]>([]);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [movieWatched, setMovieWatched] = useState(false);
  const [rewatchCount, setRewatchCount] = useState(0);
  const [showProgress, setShowProgress] = useState<ShowProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const itemId = parseInt(id as string);

        let details;
        if (type === 'movie') {
          details = await tmdbService.getMovieDetails(itemId);
        } else {
          details = await tmdbService.getTVShowDetails(itemId);
        }

        setItem(details);

        // Load streaming options
        const options = await tmdbService.getWatchProviders(itemId, type as 'movie' | 'tv');
        setStreamingOptions(options);
      } catch (error) {
        console.error('Error loading details:', error);
        setError('Failed to load details. Please check your internet connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    const checkWatchlistStatus = async () => {
      try {
        const itemId = parseInt(id as string);
        const itemType = type as 'movie' | 'tv';
        const inWatchlist = await storageService.isInWatchlist(itemId, itemType);
        setIsInWatchlist(inWatchlist);

        if (itemType === 'movie') {
          const watchlist = await storageService.getWatchlist();
          const watchlistItem = watchlist.find(w => w.id === itemId && w.type === 'movie');
          setMovieWatched(watchlistItem?.watched || false);
          setRewatchCount(watchlistItem?.rewatch_count || 0);
        }
      } catch (error) {
        console.error('Error checking watchlist status:', error);
      }
    };

    const loadShowProgress = async () => {
      if (type === 'tv') {
        try {
          const progress = await progressService.getShowProgress(parseInt(id as string));
          setShowProgress(progress);
        } catch (error) {
          console.error('Error loading show progress:', error);
        }
      }
    };

    if (type && id) {
      loadDetails();
      checkWatchlistStatus();
      loadShowProgress();
    }
  }, [type, id]);

  const handleWatchlistPress = async () => {
    if (!item) return;

    try {
      const itemId = parseInt(id as string);
      const itemType = type as 'movie' | 'tv';
      const title = 'title' in item ? item.title : item.name;
      const releaseDate = 'title' in item ? item.release_date : item.first_air_date;

      if (isInWatchlist) {
        await storageService.removeFromWatchlist(itemId, itemType);
        setIsInWatchlist(false);
        if (itemType === 'movie') setMovieWatched(false);
      } else {
        await storageService.addToWatchlist({
          id: itemId,
          type: itemType,
          title,
          poster_path: item.poster_path,
          release_date: itemType === 'movie' ? releaseDate : undefined,
          first_air_date: itemType === 'tv' ? releaseDate : undefined,
          vote_average: item.vote_average,
          watched: false,
        });
        setIsInWatchlist(true);
      }
    } catch (error) {
      console.error('Error updating watchlist:', error);
    }
  };

  const handleMarkMovieWatched = async () => {
    if (!item || type !== 'movie') return;

    try {
      const itemId = parseInt(id as string);
      const title = 'title' in item ? item.title : item.name;
      const releaseDate = 'title' in item ? item.release_date : item.first_air_date;

      if (movieWatched) {
        // Toggle off - just update local state, actual toggle logic in storage service handles status
        await storageService.toggleWatched(itemId, 'movie');
        setMovieWatched(false);
      } else {
        await storageService.markAsWatched({
          id: itemId,
          type: 'movie',
          title,
          poster_path: item.poster_path,
          release_date: releaseDate,
          vote_average: item.vote_average,
          watched: true,
        });
        setMovieWatched(true);
        setIsInWatchlist(true);
        setRewatchCount(0);
      }
    } catch (error) {
      console.error('Error marking movie as watched:', error);
    }
  };

  const handleRewatch = async () => {
    if (!item || type !== 'movie') return;
    try {
      const itemId = parseInt(id as string);
      await storageService.incrementRewatch(itemId, 'movie');
      setRewatchCount(prev => prev + 1);
    } catch (error) {
      console.error('Error incrementing rewatch:', error);
    }
  };

  const handleStartWatching = async () => {
    if (!item || type !== 'tv') return;

    try {
      const itemId = parseInt(id as string);
      // Mark S1E1 as watched
      await progressService.markEpisodeWatched(itemId, 1, 1);
      // Navigate to season 1
      router.push(`/season/${itemId}/1`);
    } catch (error) {
      console.error('Error starting to watch:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  if (error || !item) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error || 'Content not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const title = 'title' in item ? item.title : item.name;
  const releaseDate = 'title' in item ? item.release_date : item.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : '';
  const backdropUrl = tmdbService.getImageURL(item.backdrop_path, 'w1280');
  const posterUrl = tmdbService.getImageURL(item.poster_path, 'w500');

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: title,
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView style={styles.scrollView}>
        {backdropUrl && (
          <Image source={{ uri: backdropUrl }} style={styles.backdrop} />
        )}

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.posterContainer}>
              {posterUrl ? (
                <Image source={{ uri: posterUrl }} style={styles.poster} />
              ) : (
                <View style={styles.placeholderPoster}>
                  <Ionicons name="image-outline" size={40} color={Colors.textMuted} />
                </View>
              )}
            </View>

            <View style={styles.titleContainer}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.year}>{year}</Text>

              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color={Colors.primary} />
                <Text style={styles.rating}>
                  {item.vote_average.toFixed(1)} ({item.vote_count} votes)
                </Text>
              </View>

              {/* Temporary Debug Row */}
              <View style={{ padding: 8, backgroundColor: '#333', marginBottom: 12, borderRadius: 4 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>DEBUG STATE:</Text>
                <Text style={{ color: '#ccc', fontSize: 10 }}>In Watchlist: {isInWatchlist ? 'TRUE' : 'FALSE'}</Text>
                <Text style={{ color: '#ccc', fontSize: 10 }}>Watched: {movieWatched ? 'TRUE' : 'FALSE'}</Text>
                <Text style={{ color: '#ccc', fontSize: 10 }}>Rewatch Count: {rewatchCount}</Text>
              </View>

              <View style={styles.buttonContainer}>
                {type === 'movie' && (
                  <>
                    {movieWatched ? (
                      <View style={styles.watchedContainer}>
                        <View style={styles.watchedLabel}>
                          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                          <Text style={styles.watchedLabelText}>Watched</Text>
                        </View>

                        <View style={styles.rewatchContainer}>
                          <Text style={styles.rewatchText}>Rewatched: {rewatchCount} times</Text>
                          <TouchableOpacity style={styles.rewatchButton} onPress={handleRewatch}>
                            <Ionicons name="add" size={16} color={Colors.text} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.primaryButton, styles.flexButton]}
                          onPress={isInWatchlist ? handleMarkMovieWatched : handleWatchlistPress}
                        >
                          <Ionicons
                            name={isInWatchlist ? "checkmark-circle-outline" : "bookmark-outline"}
                            size={20}
                            color={Colors.text}
                          />
                          <Text style={styles.primaryButtonText}>
                            {isInWatchlist ? 'Mark as Watched' : 'Add to Watchlist'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={isInWatchlist ? handleWatchlistPress : handleMarkMovieWatched}
                        >
                          <Ionicons
                            name={isInWatchlist ? "bookmark" : "checkmark"}
                            size={24}
                            color={Colors.primary}
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}

                {type === 'tv' && (
                  <View style={styles.trackRow}>
                    <TouchableOpacity
                      style={[styles.primaryButton, styles.trackButton]}
                      onPress={() => {
                        if (!showProgress) {
                          handleStartWatching();
                          return;
                        }

                        // Determine target season
                        let targetSeason = showProgress.current_season;
                        if (item && 'seasons' in item) {
                          const currentSeasonData = item.seasons.find(s => s.season_number === showProgress.current_season);
                          if (currentSeasonData && showProgress.current_episode >= currentSeasonData.episode_count) {
                            // Current season finished, check for next
                            const nextSeason = item.seasons.find(s => s.season_number > showProgress.current_season);
                            if (nextSeason) {
                              targetSeason = nextSeason.season_number;
                            }
                          }
                        }

                        router.push(`/season/${showProgress.show_id}/${targetSeason}`);
                      }}
                    >
                      <Ionicons name="list" size={20} color={Colors.text} />
                      <Text style={styles.primaryButtonText}>
                        {(() => {
                          if (!showProgress) return 'Start Watching';

                          if (item && 'seasons' in item) {
                            const currentSeasonData = item.seasons.find(s => s.season_number === showProgress.current_season);
                            if (currentSeasonData && showProgress.current_episode >= currentSeasonData.episode_count) {
                              const nextSeason = item.seasons.find(s => s.season_number > showProgress.current_season);
                              if (nextSeason) {
                                return `Start Season ${nextSeason.season_number}`;
                              }
                              return 'Completed'; // Or keep showing current season if no next
                            }
                          }
                          return `Season ${showProgress.current_season}`;
                        })()}
                      </Text>
                    </TouchableOpacity>

                    {/* Quick Mark Button */}
                    {showProgress && (
                      <TouchableOpacity
                        style={styles.quickMarkButton}
                        onPress={async () => {
                          if (!showProgress || !item || !('seasons' in item)) return;

                          const nextEpisode = await progressService.getNextEpisodeToWatch(parseInt(id as string));

                          if (!nextEpisode) {
                            Alert.alert('All Caught Up', 'You have watched all available episodes!');
                            return;
                          }

                          // Check if the next episode has aired
                          if (nextEpisode.air_date) {
                            const airDate = new Date(nextEpisode.air_date);
                            const now = new Date();
                            airDate.setHours(0, 0, 0, 0);
                            now.setHours(0, 0, 0, 0);

                            if (airDate > now) {
                              Alert.alert("Oops...", "Nice try but you'll need to wait for this!");
                              return;
                            }
                          }
                          try {
                            await progressService.markEpisodeWatched(
                              showProgress.show_id,
                              nextEpisode.season_number,
                              nextEpisode.episode_number
                            );
                            // Refresh progress
                            const progress = await progressService.getShowProgress(parseInt(id as string));
                            setShowProgress(progress);
                          } catch (error) {
                            console.error('Error quick marking episode:', error);
                          }
                        }}
                      >
                        <Ionicons name="checkmark" size={24} color={Colors.text} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {type === 'tv' && (
                  <TouchableOpacity
                    style={[
                      styles.secondaryButton,
                      isInWatchlist && styles.secondaryButtonActive,
                    ]}
                    onPress={handleWatchlistPress}
                  >
                    <Ionicons
                      name={isInWatchlist ? "bookmark" : "bookmark-outline"}
                      size={20}
                      color={isInWatchlist ? Colors.primary : Colors.text}
                    />
                    <Text
                      style={[
                        styles.secondaryButtonText,
                        isInWatchlist && styles.secondaryButtonTextActive,
                      ]}
                    >
                      {isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          <View style={styles.overview}>
            <Text style={styles.overviewTitle}>Overview</Text>
            <Text style={styles.overviewText}>{item.overview}</Text>
          </View>

          <StreamingOptions options={streamingOptions} />

          {type === 'tv' && item && 'seasons' in item && (
            <View style={styles.seasonsSection}>
              <Text style={styles.seasonsTitle}>Seasons</Text>
              {showProgress && (
                <View style={styles.progressInfo}>
                  <Text style={styles.progressText}>
                    Currently watching: Season {showProgress.current_season}, Episode {showProgress.current_episode}
                  </Text>
                  <Text style={styles.progressText}>
                    Total watched episodes: {showProgress.total_watched_episodes}
                  </Text>
                </View>
              )}
              {(item as TVShowDetails).seasons
                .filter(season => season.season_number > 0)
                .map((season) => (
                  <TouchableOpacity
                    key={season.id}
                    style={styles.seasonCard}
                    onPress={() => router.push(`/season/${id}/${season.season_number}`)}
                  >
                    <View style={styles.seasonImageContainer}>
                      {season.poster_path ? (
                        <Image
                          source={{ uri: tmdbService.getImageURL(season.poster_path, 'w300') || '' }}
                          style={styles.seasonImage}
                        />
                      ) : (
                        <View style={styles.placeholderSeasonImage}>
                          <Ionicons name="tv-outline" size={32} color={Colors.textMuted} />
                        </View>
                      )}
                    </View>

                    <View style={styles.seasonInfo}>
                      <Text style={styles.seasonTitle}>{season.name}</Text>
                      <Text style={styles.seasonEpisodeCount}>
                        {season.episode_count} episodes
                      </Text>
                      {season.air_date && (
                        <Text style={styles.seasonAirDate}>
                          {new Date(season.air_date).getFullYear()}
                        </Text>
                      )}
                      {season.overview && (
                        <Text style={styles.seasonOverview} numberOfLines={2}>
                          {season.overview}
                        </Text>
                      )}
                    </View>

                    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
            </View>
          )}
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
  backdrop: {
    width: width,
    height: width * 0.56,
    backgroundColor: Colors.surface,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    marginTop: -60,
    marginBottom: 24,
  },
  posterContainer: {
    marginRight: 16,
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
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
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  year: {
    fontSize: 16,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  rating: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  buttonContainer: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  watchedButton: {
    backgroundColor: Colors.success,
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  secondaryButtonActive: {
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonTextActive: {
    color: Colors.primary,
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
  seasonsSection: {
    marginTop: 24,
  },
  seasonsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  progressInfo: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  seasonCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  seasonImageContainer: {
    marginRight: 12,
  },
  seasonImage: {
    width: 60,
    height: 90,
    borderRadius: 6,
    backgroundColor: Colors.card,
  },
  placeholderSeasonImage: {
    width: 60,
    height: 90,
    borderRadius: 6,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seasonInfo: {
    flex: 1,
  },
  seasonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  seasonEpisodeCount: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  seasonAirDate: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  seasonOverview: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  trackRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  trackButton: {
    flex: 1,
  },
  quickMarkButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  watchedContainer: {
    gap: 12,
  },
  watchedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  watchedLabelText: {
    color: Colors.success,
    fontSize: 16,
    fontWeight: '600',
  },
  rewatchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 8,
  },
  rewatchText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  rewatchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexButton: {
    flex: 1,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
});