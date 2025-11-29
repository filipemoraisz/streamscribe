import { ImpactHeader } from '@/components/ImpactHeader';
import { MediaSection } from '@/components/MediaSection';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { RealTimeRecommendationWidget } from '@/components/RealTimeRecommendationWidget';
import { useRealTimeStatus } from '@/components/hooks/useRealTimeStatus';
import { useAutoRefreshOnUpdates } from '@/components/hooks/useRealTimeUpdates';
import { useNotificationCount } from '@/components/hooks/useNotificationCount';
import { Colors } from '@/constants/Colors';
import { optimizerService } from '@/services/optimizer';
import { progressService } from '@/services/progress';
import { storageService } from '@/services/storage';
import { tmdbService } from '@/services/tmdb';
import { useAuth } from '@/contexts/AuthContext';
import { Movie, TVShow, WatchlistItem } from '@/types';
import { Link, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NotificationBadge } from '@/components/NotificationBadge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StreamScribeIcon } from '@/components/StreamScribeIcon';

type Section = {
  title: string;
  data: (Movie | TVShow)[];
  type: 'movie' | 'tv';
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const realTimeStatus = useRealTimeStatus();
  const { user } = useAuth();
  const { unreadCount: unreadNotifications } = useNotificationCount();
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
        const nextEpisode = await progressService.getNextEpisodeToWatch(item.id);
        if (nextEpisode && nextEpisode.season_number && nextEpisode.episode_number) {
          nextEps[item.id] = { season: nextEpisode.season_number, episode: nextEpisode.episode_number };
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

  // Auto-refresh on real-time updates
  useAutoRefreshOnUpdates(useCallback(() => {
    if (!loading && !refreshing) {
      fetchUserData();
    }
  }, [loading, refreshing]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllData();
  }, []);

  const handleItemPress = (item: Movie | TVShow, type: 'movie' | 'tv') => {
    router.push(`/details/${type}/${item.id}`);
  };

  const isInWatchlist = (id: number, type: 'movie' | 'tv') => {
    return watchlist.some((item) => item.id === id && item.type === type);
  };

  const handleNextEpisodePress = async (item: TVShow, season: number, episode: number) => {
    try {
      // Optimistic update: Update next episode locally immediately
      const currentNext = nextEpisodes[item.id];
      if (currentNext) {
        setNextEpisodes(prev => ({
          ...prev,
          [item.id]: { season: currentNext.season, episode: currentNext.episode + 1 }
        }));
      }

      // Mark as watched in background
      await progressService.markEpisodeWatched(item.id, season, episode);

      // Refresh data silently to ensure consistency
      await fetchUserData();
    } catch (error) {
      console.error('Error marking episode watched:', error);
      Alert.alert("Error", "Failed to mark episode as watched. Please try again.");
      fetchUserData();
    }
  };

  const handleWatchlistPress = async (item: Movie | TVShow, type: 'movie' | 'tv') => {
    // Optimistic update
    const isCurrentlyInWatchlist = isInWatchlist(item.id, type);

    if (isCurrentlyInWatchlist) {
      setWatchlist(prev => prev.filter(w => !(w.id === item.id && w.type === type)));
      storageService.removeFromWatchlist(item.id, type).catch(err => {
        console.error('Error removing from watchlist:', err);
        fetchUserData(); // Revert on error
      });
    } else {
      const newItem: WatchlistItem = {
        id: item.id,
        type,
        title: 'title' in item ? item.title : item.name,
        poster_path: item.poster_path,
        vote_average: item.vote_average,
        release_date: 'release_date' in item ? item.release_date : item.first_air_date,
        added_date: new Date().toISOString(),
        watched: false
      };
      setWatchlist(prev => [...prev, newItem]);
      storageService.addToWatchlist(newItem).catch(err => {
        console.error('Error adding to watchlist:', err);
        fetchUserData(); // Revert on error
      });
    }
  };

  const handleMovieActionPress = async (item: Movie) => {
    // Optimistic update: Mark as watched locally
    setWatchlist(prev => prev.map(w =>
      w.id === item.id && w.type === 'movie' ? { ...w, watched: true } : w
    ));

    // Mark as watched in background
    storageService.markAsWatched({
      id: item.id,
      type: 'movie',
      title: item.title,
      poster_path: item.poster_path,
      vote_average: item.vote_average,
      release_date: item.release_date,
    }).then(() => {
      // Refresh user data silently to ensure consistency
      fetchUserData();
    }).catch(err => {
      console.error('Error marking movie as watched:', err);
      fetchUserData(); // Revert on error
    });
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Connection Status Banner */}
      <ConnectionBanner 
        isConnected={realTimeStatus.isConnected}
        isConnecting={realTimeStatus.isConnecting}
      />
      
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 10, paddingBottom: 100 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <View style={styles.header}>
        <View style={styles.brandContainer}>
          {/* App Icon */}
          <Image
            source={require('@/assets/images/streamscribe_round.png')}
            style={styles.appIcon}
            resizeMode="contain"
          />
          
          <Image
            source={require('@/assets/images/logo-text-white.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        {/* Notification Button */}
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications" size={24} color={Colors.text} />
          <View style={styles.badgeContainer}>
            <NotificationBadge count={unreadNotifications} size="small" />
          </View>
        </TouchableOpacity>
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

      {/* Real-time Recommendations */}
      <RealTimeRecommendationWidget
        onItemPress={(item, type) => handleItemPress(item, type)}
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContainer: {
    flex: 1,
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
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appIcon: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  logo: {
    width: 120,
    height: 24,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  badgeContainer: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});