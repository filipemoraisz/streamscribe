import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View, useColorScheme } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '../../components/Logo';
import { MediaSection } from '../../components/MediaSection';
import { RecommendationsWidget } from '../../components/RecommendationsWidget';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { storageService } from '../../services/storage';
import { tmdbService } from '../../services/tmdb';
import { Movie, TVShow } from '../../types';

const HEADER_HEIGHT = 60;

export default function HomeScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === 'dark' ? 'white' : 'black';
  const insets = useSafeAreaInsets();

  const scrollY = useSharedValue(0);

  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  const [upcomingMovies, setUpcomingMovies] = useState<Movie[]>([]);
  const [nowPlayingMovies, setNowPlayingMovies] = useState<Movie[]>([]);

  const [trendingTVShows, setTrendingTVShows] = useState<TVShow[]>([]);
  const [popularTVShows, setPopularTVShows] = useState<TVShow[]>([]);
  const [topRatedTVShows, setTopRatedTVShows] = useState<TVShow[]>([]);
  const [airingTodayTVShows, setAiringTodayTVShows] = useState<TVShow[]>([]);
  const [onTheAirTVShows, setOnTheAirTVShows] = useState<TVShow[]>([]);

  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login');
    }
  }, [user]);

  useEffect(() => {
    loadData();
    loadWatchlist();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🏠 Home screen loading data...');
      const [
        trending, popular, topRated, upcoming, nowPlaying,
        trendingTV, popularTV, topRatedTV, airingTodayTV, onTheAirTV
      ] = await Promise.all([
        tmdbService.getTrendingMovies(),
        tmdbService.getPopularMovies(),
        tmdbService.getTopRatedMovies(),
        tmdbService.getUpcomingMovies(),
        tmdbService.getNowPlayingMovies(),
        tmdbService.getTrendingTVShows(),
        tmdbService.getPopularTVShows(),
        tmdbService.getTopRatedTVShows(),
        tmdbService.getAiringTodayTVShows(),
        tmdbService.getOnTheAirTVShows(),
      ]);

      setTrendingMovies(trending);
      setPopularMovies(popular);
      setTopRatedMovies(topRated);
      setUpcomingMovies(upcoming);
      setNowPlayingMovies(nowPlaying);

      setTrendingTVShows(trendingTV);
      setPopularTVShows(popularTV);
      setTopRatedTVShows(topRatedTV);
      setAiringTodayTVShows(airingTodayTV);
      setOnTheAirTVShows(onTheAirTV);

      console.log('🏠 Home screen data loaded successfully');
    } catch (err) {
      console.error('Error loading home data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadWatchlist = async () => {
    if (!user) return;
    const ids = await storageService.getWatchlistIds(user.id);
    setWatchlistIds(ids);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadWatchlist()]);
    setRefreshing(false);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP);
    return {
      opacity,
    };
  });

  const headerContainerStyle = useAnimatedStyle(() => {
    return {
      // No shadow or border as requested
    };
  });

  const handleItemPress = (item: Movie | TVShow) => {
    const type = 'title' in item ? 'movie' : 'tv';
    router.push(`/details/${type}/${item.id}`);
  };

  const handleWatchlistPress = async (item: Movie | TVShow) => {
    const type = 'title' in item ? 'movie' : 'tv';
    const key = `${type}-${item.id}`;
    const title = 'title' in item ? item.title : item.name;
    const releaseDate = 'title' in item ? item.release_date : item.first_air_date;

    try {
      if (watchlistIds.has(key)) {
        await storageService.removeFromWatchlist(item.id, type);
        setWatchlistIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      } else {
        await storageService.addToWatchlist({
          id: item.id,
          type,
          title,
          poster_path: item.poster_path,
          release_date: type === 'movie' ? releaseDate : undefined,
          first_air_date: type === 'tv' ? releaseDate : undefined,
          vote_average: item.vote_average,
        });
        setWatchlistIds(prev => new Set([...prev, key]));
      }
    } catch (error) {
      console.error('Error updating watchlist:', error);
    }
  };

  const isInWatchlist = (id: number, type: 'movie' | 'tv' = 'movie') => {
    return watchlistIds.has(`${type}-${id}`);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.retryText} onPress={loadData}>
          Tap to retry
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            progressViewOffset={HEADER_HEIGHT + insets.top}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: HEADER_HEIGHT + insets.top + 20 }
        ]}>

        <RecommendationsWidget />

        <MediaSection
          title="Trending Movies"
          data={trendingMovies}
          type="movie"
          onItemPress={handleItemPress}
          onWatchlistPress={handleWatchlistPress}
          isInWatchlist={(id) => isInWatchlist(id, 'movie')}
        />

        <MediaSection
          title="Now Playing in Theaters"
          data={nowPlayingMovies}
          type="movie"
          onItemPress={handleItemPress}
          onWatchlistPress={handleWatchlistPress}
          isInWatchlist={(id) => isInWatchlist(id, 'movie')}
        />

        <MediaSection
          title="Upcoming Movies"
          data={upcomingMovies}
          type="movie"
          onItemPress={handleItemPress}
          onWatchlistPress={handleWatchlistPress}
          isInWatchlist={(id) => isInWatchlist(id, 'movie')}
        />

        <MediaSection
          title="Top Rated Movies"
          data={topRatedMovies}
          type="movie"
          onItemPress={handleItemPress}
          onWatchlistPress={handleWatchlistPress}
          isInWatchlist={(id) => isInWatchlist(id, 'movie')}
        />

        <MediaSection
          title="Popular Movies"
          data={popularMovies}
          type="movie"
          onItemPress={handleItemPress}
          onWatchlistPress={handleWatchlistPress}
          isInWatchlist={(id) => isInWatchlist(id, 'movie')}
        />

        <MediaSection
          title="Trending TV Shows"
          data={trendingTVShows}
          type="tv"
          onItemPress={handleItemPress}
          onWatchlistPress={handleWatchlistPress}
          isInWatchlist={(id) => isInWatchlist(id, 'tv')}
        />

        <MediaSection
          title="Airing Today"
          data={airingTodayTVShows}
          type="tv"
          onItemPress={handleItemPress}
          onWatchlistPress={handleWatchlistPress}
          isInWatchlist={(id) => isInWatchlist(id, 'tv')}
        />

        <MediaSection
          title="On The Air"
          data={onTheAirTVShows}
          type="tv"
          onItemPress={handleItemPress}
          onWatchlistPress={handleWatchlistPress}
          isInWatchlist={(id) => isInWatchlist(id, 'tv')}
        />

        <MediaSection
          title="Top Rated TV Shows"
          data={topRatedTVShows}
          type="tv"
          onItemPress={handleItemPress}
          onWatchlistPress={handleWatchlistPress}
          isInWatchlist={(id) => isInWatchlist(id, 'tv')}
        />

        <MediaSection
          title="Popular TV Shows"
          data={popularTVShows}
          type="tv"
          onItemPress={handleItemPress}
          onWatchlistPress={handleWatchlistPress}
          isInWatchlist={(id) => isInWatchlist(id, 'tv')}
        />
      </Animated.ScrollView>

      {/* Sticky Header */}
      <Animated.View
        style={[
          styles.headerContainer,
          { height: HEADER_HEIGHT + insets.top, paddingTop: insets.top },
          headerContainerStyle
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, headerAnimatedStyle]}>
          <BlurView
            intensity={80}
            tint={colorScheme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={styles.headerContent}>
          <Logo />
        </View>
      </Animated.View>
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  errorText: {
    color: Colors.error,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  retryText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingBottom: 100, // Add padding for tab bar
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
});