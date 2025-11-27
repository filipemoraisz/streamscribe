import { ImpactHeader } from '@/components/ImpactHeader';
import { MediaSection } from '@/components/MediaSection';
import { Colors } from '@/constants/Colors';
import { optimizerService } from '@/services/optimizer';
import { progressService } from '@/services/progress';
import { storageService } from '@/services/storage';
import { tmdbService } from '@/services/tmdb';
import { Movie, TVShow, WatchlistItem } from '@/types';
import { Link, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Section = {
  title: string;
  data: (Movie | TVShow)[];
  type: 'movie' | 'tv';
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [sections, setSections] = useState<Section[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [nextEpisodes, setNextEpisodes] = useState<Record<number, { season: number; episode: number }>>({});
  const [stats, setStats] = useState({
    savings: 0,
    efficiency: 0,
    streak: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchContent = async () => {
    try {
      const [
        trendingMovies,
        trendingTV,
        topRatedMovies,
        topRatedTV,
        upcomingMovies,
      ] = await Promise.all([
        tmdbService.getTrendingMovies(),
        tmdbService.getTrendingTVShows(),
        tmdbService.getTopRatedMovies(),
        tmdbService.getTopRatedTVShows(),
        tmdbService.getUpcomingMovies(),
      ]);

      setSections([
        { title: 'Trending Movies', data: trendingMovies, type: 'movie' },
        { title: 'Trending TV Shows', data: trendingTV, type: 'tv' },
        { title: 'Top Rated Movies', data: topRatedMovies, type: 'movie' },
        { title: 'Top Rated TV Shows', data: topRatedTV, type: 'tv' },
        { title: 'Upcoming Movies', data: upcomingMovies, type: 'movie' },
      ]);
    } catch (error) {
      console.error('Error fetching content:', error);
    }
  };

  const fetchUserData = async () => {
    try {
      const [watchlistData, allProgress] = await Promise.all([
        storageService.getWatchlist(),
        progressService.getAllShowsProgress(),
      ]);

      setWatchlist(watchlistData);

      // Calculate next episodes for watchlist TV shows
      const nextEps: Record<number, { season: number; episode: number }> = {};
      const progressMap = new Map(allProgress.map(p => [p.show_id, p]));

      const tvWatchlist = watchlistData.filter(item => item.type === 'tv');

      await Promise.all(tvWatchlist.map(async (item) => {
        const progress = progressMap.get(item.id);
        const lastSeason = progress ? progress.current_season : 0;
        const lastEpisode = progress ? progress.current_episode : 0;

        const next = await tmdbService.getNextEpisode(item.id, lastSeason, lastEpisode);
        if (next) {
          nextEps[item.id] = next;
        }
      }));

      setNextEpisodes(nextEps);

      // Calculate stats
      const plan = await optimizerService.generateOptimizationPlan(watchlistData);
      setStats({
        savings: plan.totalAnnualSavings,
        efficiency: plan.averageEfficiency,
        streak: plan.currentStreak,
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([fetchContent(), fetchUserData()]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllData();
  }, []);

  const handleItemPress = (item: Movie | TVShow, type: 'movie' | 'tv') => {
    router.push(`/details/${type}/${item.id}`);
  };

  const handleNextEpisodePress = (item: TVShow, season: number, episode: number) => {
    router.push(`/episode/${item.id}/${season}/${episode}`);
  };

  const handleWatchlistPress = async (item: Movie | TVShow, type: 'movie' | 'tv') => {
    if (isInWatchlist(item.id, type)) {
      await storageService.removeFromWatchlist(item.id, type);
    } else {
      await storageService.addToWatchlist({
        id: item.id,
        type,
        title: 'title' in item ? item.title : item.name,
        poster_path: item.poster_path,
        vote_average: item.vote_average,
        release_date: 'release_date' in item ? item.release_date : item.first_air_date,
      });
    }
    // Refresh user data immediately
    await fetchUserData();
  };

  const handleMovieActionPress = async (item: Movie) => {
    // Mark as watched
    await storageService.markAsWatched({
      id: item.id,
      type: 'movie',
      title: item.title,
      poster_path: item.poster_path,
      vote_average: item.vote_average,
      release_date: item.release_date,
    });

    // Refresh user data immediately
    await fetchUserData();
  };

  const isInWatchlist = (id: number, type: 'movie' | 'tv') => {
    return watchlist.some((item) => item.id === id && item.type === type);
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 10, paddingBottom: 100 },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Image
            source={require('@/assets/images/logo-text-white.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>

      <ImpactHeader
        totalSavings={stats.savings}
        efficiency={stats.efficiency}
        streak={stats.streak}
      />

      {watchlist.length > 0 && (
        <MediaSection
          title="Your Watchlist"
          data={watchlist}
          type="movie" // Placeholder, handled by MediaCard
          onItemPress={(item) => handleItemPress(item, item.type as 'movie' | 'tv' || 'movie')}
          onWatchlistPress={(item) => handleWatchlistPress(item, item.type as 'movie' | 'tv' || 'movie')}
          isInWatchlist={(id) => isInWatchlist(id, 'movie') || isInWatchlist(id, 'tv')}
          nextEpisodes={nextEpisodes}
          onNextEpisodePress={handleNextEpisodePress}
          onMovieActionPress={handleMovieActionPress}
        />
      )}

      {sections.map((section) => (
        <MediaSection
          key={section.title}
          title={section.title}
          data={section.data}
          type={section.type}
          onItemPress={(item) => handleItemPress(item, section.type)}
          onWatchlistPress={(item) => handleWatchlistPress(item, section.type)}
          isInWatchlist={(id) => isInWatchlist(id, section.type)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  greeting: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  logo: {
    width: 150,
    height: 30,
    marginTop: 4,
  },
});