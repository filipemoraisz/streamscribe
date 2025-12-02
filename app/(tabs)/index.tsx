import { ImpactHeader } from '@/components/ImpactHeader';
import { MediaSection } from '@/components/MediaSection';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { StartWatchingWidget } from '@/components/start-watching-widget/StartWatchingWidget';
import { QuickFilters, QuickFilterType } from '@/components/QuickFilters';
import { SurpriseButton } from '@/components/SurpriseButton';
import WelcomeModal from '@/components/WelcomeModal';
import { ContinueWatchingSection } from '@/components/ContinueWatchingSection';
import { BecauseYouWatchedSection } from '@/components/BecauseYouWatchedSection';
import { GenreSection } from '@/components/GenreSection';
import { NewThisWeekSection } from '@/components/NewThisWeekSection';
import { LeavingSoonSection } from '@/components/LeavingSoonSection';
import { WatchlistMoviesSection } from '@/components/WatchlistMoviesSection';
import { CustomTabHeader } from '@/components/CustomTabHeader';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { useRealTimeStatus } from '@/components/hooks/useRealTimeStatus';
import { useAutoRefreshOnUpdates } from '@/components/hooks/useRealTimeUpdates';
import { useNotificationCount } from '@/components/hooks/useNotificationCount';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { optimizerService } from '@/services/optimizer';
import { progressService } from '@/services/progress';
import { storageService } from '@/services/storage';
import { tmdbService } from '@/services/tmdb';
import { tasteProfileService } from '@/services/tasteProfileService';
import { continueWatchingService, ContinueWatchingItem } from '@/services/continueWatching';
import { personalizationService } from '@/services/personalization';
import { contentDiscoveryService } from '@/services/contentDiscovery';
import { onboardingService } from '@/services/onboarding';
import { Movie, TVShow, WatchlistItem, BecauseYouWatchedSection as BecauseYouWatchedSectionType, GenreSection as GenreSectionType, LeavingSoonItem } from '@/types';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NotificationBadge } from '@/components/NotificationBadge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';

type Section = {
  title: string;
  data: (Movie | TVShow)[];
  type: 'movie' | 'tv';
};

const HEADER_HEIGHT = 110; // Increased to accommodate filters

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const realTimeStatus = useRealTimeStatus();
  const { unreadCount: unreadNotifications } = useNotificationCount();
  const { user, preferences } = useAuth();
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
  const [refreshCounter, setRefreshCounter] = useState(0);
  
  // Section-level state management
  const [sectionLoadingStates, setSectionLoadingStates] = useState<Record<string, boolean>>({});
  const [sectionErrors, setSectionErrors] = useState<Record<string, string | null>>({});
  
  // Filter state management
  const [activeFilter, setActiveFilter] = useState<QuickFilterType>('all');
  
  // Surprise Me state management
  const [surpriseMeLoading, setSurpriseMeLoading] = useState(false);

  // New sections state
  const [showWelcome, setShowWelcome] = useState(false);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [becauseYouWatched, setBecauseYouWatched] = useState<BecauseYouWatchedSectionType[]>([]);
  const [genreSections, setGenreSections] = useState<GenreSectionType[]>([]);
  const [newThisWeek, setNewThisWeek] = useState<(Movie | TVShow)[]>([]);
  const [leavingSoon, setLeavingSoon] = useState<LeavingSoonItem[]>([]);
  const [watchlistMovies, setWatchlistMovies] = useState<WatchlistItem[]>([]);

  const scrollY = useSharedValue(0);
  const lastFocusRefreshTime = React.useRef(0);

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

  // Helper functions for section-level state management
  const setSectionLoading = useCallback((sectionId: string, isLoading: boolean) => {
    setSectionLoadingStates(prev => ({
      ...prev,
      [sectionId]: isLoading,
    }));
  }, []);

  const setSectionError = useCallback((sectionId: string, error: string | null) => {
    setSectionErrors(prev => ({
      ...prev,
      [sectionId]: error,
    }));
  }, []);

  const clearSectionError = useCallback((sectionId: string) => {
    setSectionErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[sectionId];
      return newErrors;
    });
  }, []);

  const retrySectionLoad = useCallback(async (sectionId: string) => {
    // Clear any existing error
    clearSectionError(sectionId);
    
    // Set loading state
    setSectionLoading(sectionId, true);
    
    try {
      // Determine which section to reload based on sectionId
      switch (sectionId) {
        case 'watchlist':
          await fetchUserData();
          break;
        case 'stats':
          await fetchUserData();
          break;
        case 'continue-watching':
          await fetchContinueWatching();
          break;
        case 'because-you-watched':
          await fetchBecauseYouWatched();
          break;
        case 'genre-sections':
          await fetchGenreSections();
          break;
        case 'new-this-week':
          await fetchNewThisWeek();
          break;
        case 'leaving-soon':
          await fetchLeavingSoon();
          break;
        case 'trending-movies':
        case 'trending-tv':
        case 'top-rated-movies':
        case 'top-rated-tv':
        case 'upcoming-movies':
          await fetchContent();
          break;
        default:
          console.warn(`Unknown section ID: ${sectionId}`);
          throw new Error(`Unknown section: ${sectionId}`);
      }
    } catch (error) {
      console.error(`Error retrying section ${sectionId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load content';
      setSectionError(sectionId, errorMessage);
    } finally {
      setSectionLoading(sectionId, false);
    }
  }, []);

  const fetchContent = async () => {
    // Set loading states for all content sections
    setSectionLoading('trending-movies', true);
    setSectionLoading('trending-tv', true);
    setSectionLoading('top-rated-movies', true);
    setSectionLoading('top-rated-tv', true);
    setSectionLoading('upcoming-movies', true);

    try {
      const [
        trendingMovies,
        trendingTV,
        topRatedMovies,
        topRatedTV,
        upcomingMovies,
      ] = await Promise.all([
        tmdbService.getTrendingMovies().catch(err => {
          console.error('Error fetching trending movies:', err);
          setSectionError('trending-movies', 'Failed to load trending movies');
          return [];
        }),
        tmdbService.getTrendingTVShows().catch(err => {
          console.error('Error fetching trending TV shows:', err);
          setSectionError('trending-tv', 'Failed to load trending TV shows');
          return [];
        }),
        tmdbService.getTopRatedMovies().catch(err => {
          console.error('Error fetching top rated movies:', err);
          setSectionError('top-rated-movies', 'Failed to load top rated movies');
          return [];
        }),
        tmdbService.getTopRatedTVShows().catch(err => {
          console.error('Error fetching top rated TV shows:', err);
          setSectionError('top-rated-tv', 'Failed to load top rated TV shows');
          return [];
        }),
        tmdbService.getUpcomingMovies().catch(err => {
          console.error('Error fetching upcoming movies:', err);
          setSectionError('upcoming-movies', 'Failed to load upcoming movies');
          return [];
        }),
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
      // Set error for all sections if Promise.all fails catastrophically
      const errorMessage = error instanceof Error ? error.message : 'Failed to load content';
      setSectionError('trending-movies', errorMessage);
      setSectionError('trending-tv', errorMessage);
      setSectionError('top-rated-movies', errorMessage);
      setSectionError('top-rated-tv', errorMessage);
      setSectionError('upcoming-movies', errorMessage);
    } finally {
      // Clear loading states
      setSectionLoading('trending-movies', false);
      setSectionLoading('trending-tv', false);
      setSectionLoading('top-rated-movies', false);
      setSectionLoading('top-rated-tv', false);
      setSectionLoading('upcoming-movies', false);
    }
  };

  const fetchContinueWatching = async () => {
    if (!user) return;
    
    setSectionLoading('continue-watching', true);
    try {
      const items = await continueWatchingService.getContinueWatching();
      setContinueWatching(items);
      clearSectionError('continue-watching');
    } catch (error) {
      console.error('Error fetching continue watching:', error);
      setSectionError('continue-watching', 'Failed to load continue watching');
    } finally {
      setSectionLoading('continue-watching', false);
    }
  };

  const fetchBecauseYouWatched = async () => {
    if (!user) return;
    
    setSectionLoading('because-you-watched', true);
    try {
      const sections = await personalizationService.generateBecauseYouWatched(user.id);
      setBecauseYouWatched(sections);
      clearSectionError('because-you-watched');
    } catch (error) {
      console.error('Error fetching because you watched:', error);
      setSectionError('because-you-watched', 'Failed to load recommendations');
    } finally {
      setSectionLoading('because-you-watched', false);
    }
  };

  const fetchGenreSections = async () => {
    if (!user) return;
    
    setSectionLoading('genre-sections', true);
    try {
      const sections = await tasteProfileService.generateGenreSections(user.id);
      setGenreSections(sections);
      clearSectionError('genre-sections');
    } catch (error) {
      console.error('Error fetching genre sections:', error);
      setSectionError('genre-sections', 'Failed to load genre sections');
    } finally {
      setSectionLoading('genre-sections', false);
    }
  };

  const fetchNewThisWeek = async () => {
    setSectionLoading('new-this-week', true);
    try {
      const items = await contentDiscoveryService.getNewThisWeek();
      setNewThisWeek(items);
      clearSectionError('new-this-week');
    } catch (error) {
      console.error('Error fetching new this week:', error);
      setSectionError('new-this-week', 'Failed to load new releases');
    } finally {
      setSectionLoading('new-this-week', false);
    }
  };

  const fetchLeavingSoon = async () => {
    if (!user) {
      console.log('No user available for leaving soon content');
      return;
    }
    
    setSectionLoading('leaving-soon', true);
    try {
      const items = await contentDiscoveryService.getLeavingSoon(user.id);
      console.log('Leaving Soon items fetched:', items.length);
      setLeavingSoon(items);
      clearSectionError('leaving-soon');
    } catch (error) {
      console.error('Error fetching leaving soon:', error);
      setSectionError('leaving-soon', 'Failed to load leaving soon');
    } finally {
      setSectionLoading('leaving-soon', false);
    }
  };

  const fetchUserData = async () => {
    // Set loading states for user data sections
    setSectionLoading('watchlist', true);
    setSectionLoading('stats', true);

    try {
      const [watchlistData] = await Promise.all([
        storageService.getWatchlist().catch(err => {
          console.error('Error fetching watchlist:', err);
          setSectionError('watchlist', 'Failed to load watchlist');
          return [];
        }),
      ]);

      setWatchlist(watchlistData);
      
      // Filter and set watchlist movies (unwatched movies only)
      const unwatchedMovies = watchlistData.filter(item => item.type === 'movie' && !item.watched);
      setWatchlistMovies(unwatchedMovies);
      
      clearSectionError('watchlist');

      // Calculate next episodes for watchlist TV shows - OPTIMIZED: Single batch query
      const tvWatchlist = watchlistData.filter(item => item.type === 'tv');
      const showIds = tvWatchlist.map(item => item.id);
      
      try {
        const nextEpisodesMap = await progressService.getNextEpisodesForShows(showIds);
        
        const nextEps: Record<number, { season: number; episode: number }> = {};
        nextEpisodesMap.forEach((value, key) => {
          nextEps[key] = value;
        });
        setNextEpisodes(nextEps);
      } catch (error) {
        console.error('Error fetching next episodes:', error);
        // Don't set error state for next episodes as it's not critical
      }

      // Calculate stats
      try {
        const plan = await optimizerService.generateOptimizationPlan(watchlistData);
        setStats({
          savings: plan.totalAnnualSavings,
          efficiency: plan.averageEfficiency,
          streak: plan.currentStreak,
        });
        clearSectionError('stats');
      } catch (error) {
        console.error('Error calculating stats:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load stats';
        setSectionError('stats', errorMessage);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load user data';
      setSectionError('watchlist', errorMessage);
      setSectionError('stats', errorMessage);
    } finally {
      // Clear loading states
      setSectionLoading('watchlist', false);
      setSectionLoading('stats', false);
    }
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      
      // Check if user has seen welcome modal
      try {
        const hasSeenWelcome = await onboardingService.hasSeenWelcome();
        setShowWelcome(!hasSeenWelcome);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // Default to not showing welcome modal on error
        setShowWelcome(false);
      }
      
      // PHASE 1: Load user data first (watchlist, stats, continue watching)
      // This is fastest as it comes from local storage/database
      try {
        await fetchUserData();
      } catch (error) {
        console.error('Error loading user data:', error);
        // Continue loading other sections even if user data fails
      }
      
      // Show UI immediately after user data loads
      setLoading(false);
      
      // PHASE 2: Load personalized sections second (recommendations, genres)
      // These require processing user's watch history
      if (user) {
        // Load continue watching (user-specific, requires database query)
        fetchContinueWatching().catch(error => {
          console.error('Error loading continue watching:', error);
        });
        
        // Load personalized recommendations (requires taste profile analysis)
        fetchBecauseYouWatched().catch(error => {
          console.error('Error loading because you watched:', error);
        });
        
        // Load genre sections (requires watch history analysis)
        fetchGenreSections().catch(error => {
          console.error('Error loading genre sections:', error);
        });
      }
      
      // PHASE 3: Load TMDB content last (trending, new releases)
      // These are external API calls and can be slower
      
      // Load discovery content (new this week, leaving soon)
      fetchNewThisWeek().catch(error => {
        console.error('Error loading new this week:', error);
      });
      
      fetchLeavingSoon().catch(error => {
        console.error('Error loading leaving soon:', error);
      });
      
      // Load trending content sections
      fetchContent().catch(error => {
        console.error('Error loading content:', error);
      });
    } catch (error) {
      console.error('Critical error in loadAllData:', error);
      // Even on critical error, try to show UI
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Only refresh user data on focus if we've been away for a while (30+ seconds)
  // This prevents unnecessary refreshes when quickly switching tabs
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const timeSinceLastRefresh = now - lastFocusRefreshTime.current;
      
      // Only refresh if it's been more than 30 seconds since last refresh
      if (timeSinceLastRefresh > 30000) {
        fetchUserData();
        lastFocusRefreshTime.current = now;
      }
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
    setRefreshCounter(prev => prev + 1); // Trigger widget refresh
    loadAllData();
  }, []);

  // Filter change handler
  const handleFilterChange = useCallback((filter: QuickFilterType) => {
    setActiveFilter(filter);
  }, []);

  // Surprise Me handler
  const handleSurpriseMe = useCallback(async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to use Surprise Me');
      return;
    }

    setSurpriseMeLoading(true);

    try {
      // Build taste profile
      const profile = await tasteProfileService.buildTasteProfile(user.id);
      
      // Get subscribed services
      const subscribedServices = preferences?.subscribed_services || [];
      
      // Get watchlist IDs to exclude
      const excludeIds = new Set(
        watchlist.map(item => `${item.type}-${item.id}`)
      );

      // Try to get taste-based recommendations
      let recommendations = await tasteProfileService.generateTasteRecommendations(
        profile,
        subscribedServices,
        excludeIds,
        10
      );

      // If no recommendations, fall back to trending content
      if (recommendations.length === 0) {
        console.log('No taste recommendations, falling back to trending content');
        
        const [trendingMovies, trendingTV] = await Promise.all([
          tmdbService.getTrendingMovies(),
          tmdbService.getTrendingTVShows(),
        ]);

        // Combine and filter out watchlist items
        const trendingContent = [
          ...trendingMovies.slice(0, 5).map(m => ({ ...m, type: 'movie' as const })),
          ...trendingTV.slice(0, 5).map(t => ({ ...t, type: 'tv' as const })),
        ].filter(item => !excludeIds.has(`${item.type}-${item.id}`));

        if (trendingContent.length === 0) {
          Alert.alert('No Content', 'No content available for surprise selection');
          return;
        }

        // Select random item from trending
        const randomIndex = Math.floor(Math.random() * trendingContent.length);
        const selectedItem = trendingContent[randomIndex];
        
        // Navigate to detail screen
        router.push(`/details/${selectedItem.type}/${selectedItem.id}`);
      } else {
        // Select random item from recommendations
        const randomIndex = Math.floor(Math.random() * recommendations.length);
        const selectedItem = recommendations[randomIndex];
        
        // Navigate to detail screen
        router.push(`/details/${selectedItem.type}/${selectedItem.id}`);
      }
    } catch (error) {
      console.error('Error in Surprise Me:', error);
      Alert.alert('Error', 'Failed to find a surprise recommendation. Please try again.');
    } finally {
      setSurpriseMeLoading(false);
    }
  }, [user, preferences, watchlist]);

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
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark episode as watched';
      Alert.alert("Error", `${errorMessage}. Please try again.`);
      // Revert optimistic update by refreshing data
      fetchUserData().catch(err => {
        console.error('Error reverting episode update:', err);
      });
    }
  };

  const handleWatchlistPress = async (item: Movie | TVShow, type: 'movie' | 'tv') => {
    try {
      // Optimistic update
      const isCurrentlyInWatchlist = isInWatchlist(item.id, type);

      if (isCurrentlyInWatchlist) {
        setWatchlist(prev => prev.filter(w => !(w.id === item.id && w.type === type)));
        
        // Also remove from watchlist movies if it's a movie
        if (type === 'movie') {
          setWatchlistMovies(prev => prev.filter(w => w.id !== item.id));
        }
        
        try {
          await storageService.removeFromWatchlist(item.id, type);
        } catch (err) {
          console.error('Error removing from watchlist:', err);
          // Revert on error
          await fetchUserData().catch(fetchErr => {
            console.error('Error reverting watchlist removal:', fetchErr);
          });
          throw err;
        }
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
        
        // Also add to watchlist movies if it's a movie
        if (type === 'movie') {
          setWatchlistMovies(prev => [...prev, newItem]);
        }
        
        try {
          await storageService.addToWatchlist(newItem);
        } catch (err) {
          console.error('Error adding to watchlist:', err);
          // Revert on error
          await fetchUserData().catch(fetchErr => {
            console.error('Error reverting watchlist addition:', fetchErr);
          });
          throw err;
        }
      }
    } catch (error) {
      console.error('Error updating watchlist:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update watchlist';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleMovieActionPress = async (item: Movie) => {
    try {
      // Optimistic update: Mark as watched locally
      setWatchlist(prev => prev.map(w =>
        w.id === item.id && w.type === 'movie' ? { ...w, watched: true } : w
      ));
      
      // Remove from watchlist movies (since it's now watched)
      setWatchlistMovies(prev => prev.filter(w => w.id !== item.id));

      // Mark as watched in background
      await storageService.markAsWatched({
        id: item.id,
        type: 'movie',
        title: item.title,
        poster_path: item.poster_path,
        vote_average: item.vote_average,
        release_date: item.release_date,
        watched: true,
      });
      
      // Refresh user data silently to ensure consistency
      await fetchUserData();
    } catch (error) {
      console.error('Error marking movie as watched:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark movie as watched';
      Alert.alert('Error', errorMessage);
      // Revert on error
      await fetchUserData().catch(err => {
        console.error('Error reverting movie watched status:', err);
      });
    }
  };

  // Welcome modal handlers
  const handleWelcomeDismiss = async () => {
    try {
      await onboardingService.markWelcomeSeen();
      setShowWelcome(false);
    } catch (error) {
      console.error('Error dismissing welcome modal:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save welcome dismissal';
      // Still dismiss the modal even if saving fails
      setShowWelcome(false);
      // Log but don't show alert as this is not critical
      console.warn('Welcome dismissal not saved:', errorMessage);
    }
  };

  const handleGetStarted = async () => {
    await handleWelcomeDismiss();
  };

  // Continue watching handlers
  const handleContinueWatchingItemPress = (item: ContinueWatchingItem) => {
    try {
      if (item.type === 'tv' && item.nextEpisode) {
        router.push(`/episode/${item.id}/${item.nextEpisode.season}/${item.nextEpisode.episode}`);
      } else {
        router.push(`/details/${item.type}/${item.id}`);
      }
    } catch (error) {
      console.error('Error navigating to continue watching item:', error);
      Alert.alert('Error', 'Failed to open content. Please try again.');
    }
  };

  const handleContinueWatchingRemove = async (id: number, type: 'movie' | 'tv') => {
    try {
      // Remove from continue watching list optimistically
      setContinueWatching(prev => prev.filter(item => !(item.id === id && item.type === type)));
      
      // Note: Actual removal would require marking as completed or dropped in progress service
      // For now, just update the UI
    } catch (error) {
      console.error('Error removing from continue watching:', error);
      // Revert by refetching
      await fetchContinueWatching().catch(err => {
        console.error('Error reverting continue watching removal:', err);
      });
    }
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
      {/* Welcome Modal - Top level overlay */}
      <WelcomeModal
        visible={showWelcome}
        onDismiss={handleWelcomeDismiss}
        onGetStarted={handleGetStarted}
      />

      {/* Connection Status Banner */}
      <ConnectionBanner
        isConnected={realTimeStatus.isConnected}
        isConnecting={realTimeStatus.isConnecting}
      />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.content,
          { paddingTop: HEADER_HEIGHT + insets.top + 20 }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            progressViewOffset={HEADER_HEIGHT + insets.top}
          />
        }
      >
        <ImpactHeader
          totalSavings={stats.savings}
          efficiency={stats.efficiency}
          streak={stats.streak}
        />

        {/* Continue Watching Section - Before watchlist */}
        {sectionLoadingStates['continue-watching'] && continueWatching.length === 0 ? (
          <SkeletonLoader type="section" />
        ) : (
          <ContinueWatchingSection
            items={continueWatching}
            onItemPress={handleContinueWatchingItemPress}
            onRemove={handleContinueWatchingRemove}
            loading={sectionLoadingStates['continue-watching']}
            error={sectionErrors['continue-watching']}
            onRetry={() => retrySectionLoad('continue-watching')}
            activeFilter={activeFilter}
          />
        )}

        {/* Movies From Your Watchlist - NEW SECTION */}
        <WatchlistMoviesSection
          movies={watchlistMovies}
          onItemPress={(item) => handleItemPress(item as any, 'movie')}
          onWatchlistPress={(item) => handleWatchlistPress(item as any, 'movie')}
          onMovieActionPress={(item) => handleMovieActionPress(item as any)}
          loading={sectionLoadingStates['watchlist']}
          error={sectionErrors['watchlist']}
          onRetry={() => retrySectionLoad('watchlist')}
        />

        {/* Surprise Me Button - Before recommendations widget */}
        <SurpriseButton
          onPress={handleSurpriseMe}
          loading={surpriseMeLoading}
        />

        {/* Start Watching Widget - UNCHANGED position */}
        <StartWatchingWidget
          onItemPress={(item, type) => {
            // Convert RecommendationItem to Movie/TVShow for navigation
            router.push(`/details/${type}/${item.id}`);
          }}
          refreshTrigger={refreshCounter} // Refresh on manual pull-to-refresh
        />

        {/* Because You Watched Sections - After StartWatchingWidget */}
        {sectionLoadingStates['because-you-watched'] && becauseYouWatched.length === 0 ? (
          <>
            <SkeletonLoader type="section" />
            <SkeletonLoader type="section" />
          </>
        ) : (
          becauseYouWatched.map((section) => (
            <BecauseYouWatchedSection
              key={`because-you-watched-${section.sourceId}`}
              sourceTitle={section.sourceTitle}
              items={section.items}
              type={section.sourceType}
              onItemPress={handleItemPress}
              onWatchlistPress={handleWatchlistPress}
              isInWatchlist={(id) => isInWatchlist(id, section.sourceType)}
              loading={sectionLoadingStates['because-you-watched']}
              error={sectionErrors['because-you-watched']}
              onRetry={() => retrySectionLoad('because-you-watched')}
              activeFilter={activeFilter}
            />
          ))
        )}

        {/* Genre Sections - After personalized recommendations */}
        {sectionLoadingStates['genre-sections'] && genreSections.length === 0 ? (
          <>
            <SkeletonLoader type="section" />
            <SkeletonLoader type="section" />
            <SkeletonLoader type="section" />
          </>
        ) : (
          genreSections.map((section) => (
            <GenreSection
              key={`genre-${section.genreId}`}
              genreName={section.genreName}
              items={section.items}
              type={section.type}
              onItemPress={handleItemPress}
              onWatchlistPress={handleWatchlistPress}
              isInWatchlist={(id) => isInWatchlist(id, section.type)}
              loading={sectionLoadingStates['genre-sections']}
              error={sectionErrors['genre-sections']}
              onRetry={() => retrySectionLoad('genre-sections')}
              activeFilter={activeFilter}
            />
          ))
        )}

        {/* New This Week Section - After genre sections */}
        {sectionLoadingStates['new-this-week'] && newThisWeek.length === 0 ? (
          <SkeletonLoader type="section" />
        ) : (
          <NewThisWeekSection
            items={newThisWeek}
            onItemPress={handleItemPress}
            onWatchlistPress={handleWatchlistPress}
            isInWatchlist={(id) => {
              // Check both movie and tv watchlists
              return isInWatchlist(id, 'movie') || isInWatchlist(id, 'tv');
            }}
            loading={sectionLoadingStates['new-this-week']}
            error={sectionErrors['new-this-week']}
            onRetry={() => retrySectionLoad('new-this-week')}
            activeFilter={activeFilter}
          />
        )}

        {/* Leaving Soon Section - After new content */}
        {sectionLoadingStates['leaving-soon'] && leavingSoon.length === 0 ? (
          <SkeletonLoader type="section" />
        ) : (
          <LeavingSoonSection
            items={leavingSoon}
            onItemPress={(item) => handleItemPress(item as any, item.type)}
            onWatchlistPress={(item) => handleWatchlistPress(item as any, item.type)}
            isInWatchlist={(id) => {
              // Check both movie and tv watchlists
              return isInWatchlist(id, 'movie') || isInWatchlist(id, 'tv');
            }}
            loading={sectionLoadingStates['leaving-soon']}
            error={sectionErrors['leaving-soon']}
            onRetry={() => retrySectionLoad('leaving-soon')}
            activeFilter={activeFilter}
          />
        )}

        {/* Your Watchlist - MOVED to bottom of personalized content */}
        <MediaSection
          title="Your Watchlist"
          data={watchlist}
          type="movie" // Placeholder, handled by MediaCard
          onItemPress={(item) => {
            const watchlistItem = item as unknown as WatchlistItem;
            handleItemPress(item, watchlistItem.type);
          }}
          onWatchlistPress={(item) => {
            const watchlistItem = item as unknown as WatchlistItem;
            handleWatchlistPress(item, watchlistItem.type);
          }}
          isInWatchlist={(id) => isInWatchlist(id, 'movie') || isInWatchlist(id, 'tv')}
          nextEpisodes={nextEpisodes}
          onNextEpisodePress={handleNextEpisodePress}
          onMovieActionPress={handleMovieActionPress}
          filterType="all"
          activeFilter={activeFilter}
          loading={sectionLoadingStates['watchlist']}
          error={sectionErrors['watchlist']}
          onRetry={() => retrySectionLoad('watchlist')}
          emptyMessage="Your watchlist is empty. Start adding movies and TV shows to watch!"
          emptyActionLabel="Browse Content"
          onEmptyAction={() => router.push('/(tabs)/search')}
        />

        {/* Existing Media Sections - Updated with new props */}
        {sections.length === 0 && (
          sectionLoadingStates['trending-movies'] ||
          sectionLoadingStates['trending-tv'] ||
          sectionLoadingStates['top-rated-movies'] ||
          sectionLoadingStates['top-rated-tv'] ||
          sectionLoadingStates['upcoming-movies']
        ) ? (
          <>
            <SkeletonLoader type="section" />
            <SkeletonLoader type="section" />
            <SkeletonLoader type="section" />
            <SkeletonLoader type="section" />
            <SkeletonLoader type="section" />
          </>
        ) : (
          sections.map((section) => (
            <MediaSection
              key={section.title}
              title={section.title}
              data={section.data}
              type={section.type}
              onItemPress={(item) => handleItemPress(item, section.type)}
              onWatchlistPress={(item) => handleWatchlistPress(item, section.type)}
              isInWatchlist={(id) => isInWatchlist(id, section.type)}
              filterType={section.type}
              activeFilter={activeFilter}
              loading={sectionLoadingStates[section.title.toLowerCase().replace(/\s+/g, '-')]}
              error={sectionErrors[section.title.toLowerCase().replace(/\s+/g, '-')]}
              onRetry={() => retrySectionLoad(section.title.toLowerCase().replace(/\s+/g, '-'))}
              emptyMessage={`No ${section.type === 'movie' ? 'movies' : 'TV shows'} available at the moment.`}
            />
          ))
        )}

      </Animated.ScrollView>

      {/* Sticky Header with Blur */}
      <CustomTabHeader
        logoImage={require('@/assets/images/logo-text-white.png')}
        headerAnimatedStyle={headerAnimatedStyle}
        height={HEADER_HEIGHT + insets.top}
        paddingTop={insets.top}
        rightButton={
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications" size={24} color={Colors.text} />
            <View style={styles.badgeContainer}>
              <NotificationBadge count={unreadNotifications} size="small" />
            </View>
          </TouchableOpacity>
        }
      >
        {/* Quick Filters inside header */}
        <View style={styles.filtersRow}>
          <QuickFilters
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
          />
        </View>
      </CustomTabHeader>
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
    paddingBottom: 100,
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
    flexDirection: 'column',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 60,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  filtersRow: {
    paddingBottom: 8,
    paddingLeft: 0,
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