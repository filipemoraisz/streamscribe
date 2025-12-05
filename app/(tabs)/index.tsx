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
import { AtAGlanceHero } from '@/components/AtAGlanceHero';
import { ContextualRecommendationsModal } from '@/components/ContextualRecommendationsModal';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { useRealTimeStatus } from '@/components/hooks/useRealTimeStatus';
import { useAutoRefreshOnUpdates } from '@/components/hooks/useRealTimeUpdates';
import { useNotificationCount } from '@/components/hooks/useNotificationCount';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { optimizerService } from '@/services/optimizer';
import { progressService } from '@/services/progress';
import { storageService } from '@/services/storage';
import { userActivityService } from '@/services/userActivity';
import { achievementsService } from '@/services/achievements';
import { tmdbService } from '@/services/tmdb';
import { tasteProfileService } from '@/services/tasteProfileService';
import { continueWatchingService, ContinueWatchingItem } from '@/services/continueWatching';
import { personalizationService } from '@/services/personalization';
import { contentDiscoveryService } from '@/services/contentDiscovery';
import { onboardingService } from '@/services/onboarding';
import { contextualMessagingService } from '@/services/contextualMessaging';
import { Movie, TVShow, WatchlistItem, BecauseYouWatchedSection as BecauseYouWatchedSectionType, GenreSection as GenreSectionType, LeavingSoonItem, UserStats, AchievementStats } from '@/types';
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

const HEADER_HEIGHT = 120; // Increased to accommodate filters

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
  
  // Cache timestamps for smart refresh logic
  const watchlistCacheTime = React.useRef(0);
  const WATCHLIST_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  // Request deduplication to prevent multiple simultaneous requests
  const pendingRequests = React.useRef<Map<string, Promise<any>>>(new Map());
  
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
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  
  // Memoize watchlist movies to prevent unnecessary recalculations
  const watchlistMovies = React.useMemo(() => {
    return watchlist.filter(item => item.type === 'movie' && !item.watched);
  }, [watchlist]);
  
  // Contextual recommendations modal state
  const [showContextualModal, setShowContextualModal] = useState(false);
  const [contextualGenres, setContextualGenres] = useState<number[]>([]);
  const [contextualMood, setContextualMood] = useState('');
  const [contextualMessage, setContextualMessage] = useState('');

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
    
    // Request deduplication
    if (pendingRequests.current.has('continueWatching')) {
      console.log('[HomeScreen] ⏭️ Skipping duplicate continueWatching request');
      return pendingRequests.current.get('continueWatching');
    }
    
    console.log('[HomeScreen] 🔄 Fetching Continue Watching...');
    setSectionLoading('continue-watching', true);
    
    const promise = (async () => {
      try {
      const items = await continueWatchingService.getContinueWatching();
      console.log(`[HomeScreen] ✅ Continue Watching loaded: ${items.length} items`, items.map(i => ({
        title: i.title,
        nextEp: i.nextEpisode ? `S${i.nextEpisode.season}E${i.nextEpisode.episode}` : 'N/A',
        progress: `${i.progress}%`
      })));
      setContinueWatching(items);
      clearSectionError('continue-watching');
    } catch (error) {
      console.error('[HomeScreen] ❌ Error fetching continue watching:', error);
      setSectionError('continue-watching', 'Failed to load continue watching');
    } finally {
      setSectionLoading('continue-watching', false);
      pendingRequests.current.delete('continueWatching');
    }
    })();
    
    pendingRequests.current.set('continueWatching', promise);
    return promise;
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

  const fetchUserStats = async () => {
    // Fetch ONLY user stats (for "Your Journey" widget)
    // This is called when episodes are marked as watched
    
    try {
      if (!user) return;

      // Try to load from cache first
      const cachedStats = await storageService.getCachedUserStats();
      
      if (cachedStats) {
        // Use cached stats immediately (NO loading state!)
        setUserStats(cachedStats);
        clearSectionError('stats');
        
        // Fetch fresh data in background and update cache silently
        Promise.all([
          userActivityService.getUserStats(user.id),
          achievementsService.getAchievementStats(user.id),
          optimizerService.generateOptimizationPlan(watchlist) // Use existing watchlist state
        ]).then(([stats, achStats, optimizationPlan]) => {
          const freshStats = {
            ...stats,
            achievementsTotal: achStats.total_available,
            totalSavings: optimizationPlan.totalAnnualSavings,
          };
          
          setUserStats(freshStats);
          storageService.cacheUserStats(freshStats);
          
          // Store old stats format
          setStats({
            savings: optimizationPlan.totalAnnualSavings,
            efficiency: optimizationPlan.averageEfficiency,
            streak: optimizationPlan.currentStreak,
          });
        }).catch(err => {
          console.error('Error refreshing stats in background:', err);
        });
      } else {
        // No cache - show loading state only on first load
        setSectionLoading('stats', true);
        
        const [stats, achStats, optimizationPlan] = await Promise.all([
          userActivityService.getUserStats(user.id),
          achievementsService.getAchievementStats(user.id),
          optimizerService.generateOptimizationPlan(watchlist) // Use existing watchlist state
        ]);
        
        const freshStats = {
          ...stats,
          achievementsTotal: achStats.total_available,
          totalSavings: optimizationPlan.totalAnnualSavings,
        };
        
        setUserStats(freshStats);
        storageService.cacheUserStats(freshStats);
        
        // Store old stats format
        setStats({
          savings: optimizationPlan.totalAnnualSavings,
          efficiency: optimizationPlan.averageEfficiency,
          streak: optimizationPlan.currentStreak,
        });
        
        clearSectionError('stats');
        setSectionLoading('stats', false);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load stats';
      setSectionError('stats', errorMessage);
      setSectionLoading('stats', false);
    }
  };

  const fetchUserData = async () => {
    // Request deduplication: Check if already fetching
    if (pendingRequests.current.has('userData')) {
      console.log('[HomeScreen] ⏭️ Skipping duplicate userData request');
      return pendingRequests.current.get('userData');
    }
    
    // Set loading states for user data sections
    setSectionLoading('watchlist', true);
    setSectionLoading('stats', true);

    const promise = (async () => {
      try {
      const [watchlistData] = await Promise.all([
        storageService.getWatchlist().catch(err => {
          console.error('Error fetching watchlist:', err);
          setSectionError('watchlist', 'Failed to load watchlist');
          return [];
        }),
      ]);

      setWatchlist(watchlistData);
      watchlistCacheTime.current = Date.now(); // Update cache timestamp
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

      // Fetch user stats for At a Glance hero
      if (user) {
        try {
          // Try to load from cache first
          const cachedStats = await storageService.getCachedUserStats();
          
          if (cachedStats) {
            // Use cached stats immediately
            setUserStats(cachedStats);
            clearSectionError('stats');
            
            // Fetch fresh data in background and update cache
            Promise.all([
              userActivityService.getUserStats(user.id),
              achievementsService.getAchievementStats(user.id),
              optimizerService.generateOptimizationPlan(watchlistData)
            ]).then(([stats, achStats, optimizationPlan]) => {
              const freshStats = {
                ...stats,
                achievementsTotal: achStats.total_available,
                totalSavings: optimizationPlan.totalAnnualSavings,
              };
              
              setUserStats(freshStats);
              storageService.cacheUserStats(freshStats);
              
              // Store old stats format
              setStats({
                savings: optimizationPlan.totalAnnualSavings,
                efficiency: optimizationPlan.averageEfficiency,
                streak: optimizationPlan.currentStreak,
              });
            }).catch(err => {
              console.error('Error refreshing stats in background:', err);
            });
          } else {
            // No cache, fetch fresh data
            const [stats, achStats, optimizationPlan] = await Promise.all([
              userActivityService.getUserStats(user.id),
              achievementsService.getAchievementStats(user.id),
              optimizerService.generateOptimizationPlan(watchlistData)
            ]);
            
            const freshStats = {
              ...stats,
              achievementsTotal: achStats.total_available,
              totalSavings: optimizationPlan.totalAnnualSavings,
            };
            
            setUserStats(freshStats);
            storageService.cacheUserStats(freshStats);
            
            // Store old stats format
            setStats({
              savings: optimizationPlan.totalAnnualSavings,
              efficiency: optimizationPlan.averageEfficiency,
              streak: optimizationPlan.currentStreak,
            });
            
            clearSectionError('stats');
          }
        } catch (error) {
          console.error('Error fetching user stats:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to load stats';
          setSectionError('stats', errorMessage);
        }
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
      pendingRequests.current.delete('userData');
    }
    })();
    
    pendingRequests.current.set('userData', promise);
    return promise;
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      
      // WAVE 1: Critical data (instant from cache)
      console.log('[HomeScreen] 🌊 Wave 1: Loading cached data...');
      if (user) {
        const cachedStats = await storageService.getCachedUserStats();
        if (cachedStats) {
          setUserStats(cachedStats);
          console.log('[HomeScreen] ⚡ Loaded cached stats instantly');
        }
      }
      
      // Check if user has seen welcome modal
      try {
        const hasSeenWelcome = await onboardingService.hasSeenWelcome();
        setShowWelcome(!hasSeenWelcome);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setShowWelcome(false);
      }
      
      // WAVE 2: User data (fast, from local storage)
      console.log('[HomeScreen] 🌊 Wave 2: Loading user data...');
      try {
        await fetchUserData();
      } catch (error) {
        console.error('Error loading user data:', error);
      }
      
      // Show UI immediately after user data loads
      setLoading(false);
      console.log('[HomeScreen] ✅ UI ready, loading remaining content in background...');
      
      // WAVE 3: Personalized content (medium priority)
      if (user) {
        console.log('[HomeScreen] 🌊 Wave 3: Loading personalized content...');
        await Promise.allSettled([
          fetchContinueWatching(),
          fetchBecauseYouWatched(),
        ]);
      }
      
      // WAVE 4: Discovery content (lower priority)
      console.log('[HomeScreen] 🌊 Wave 4: Loading discovery content...');
      await Promise.allSettled([
        fetchGenreSections(),
        fetchNewThisWeek(),
        fetchLeavingSoon(),
      ]);
      
      // WAVE 5: Generic content (lowest priority)
      console.log('[HomeScreen] 🌊 Wave 5: Loading generic content...');
      await fetchContent();
      
      console.log('[HomeScreen] 🎉 All content loaded!');
    } catch (error) {
      console.error('Critical error in loadAllData:', error);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Subscribe to progress updates for real-time Continue Watching and Stats refresh
  useEffect(() => {
    const unsubscribe = progressService.onProgressUpdate(() => {
      // Refresh Continue Watching when progress changes
      fetchContinueWatching().catch(error => {
        console.error('Error refreshing continue watching:', error);
      });
      
      // Refresh ONLY user stats (not watchlist) to update "Your Journey" widget
      fetchUserStats().catch(error => {
        console.error('Error refreshing user stats:', error);
      });
    });

    return () => unsubscribe();
  }, []);

  // Smart focus refresh: Only refresh stale data
  // This prevents unnecessary refreshes when quickly switching tabs
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const timeSinceLastRefresh = now - lastFocusRefreshTime.current;
      
      // Only refresh if it's been more than 30 seconds since last refresh
      if (timeSinceLastRefresh > 30000) {
        const watchlistCacheAge = now - watchlistCacheTime.current;
        
        // Check if watchlist cache is still valid
        if (watchlistCacheAge > WATCHLIST_CACHE_DURATION) {
          // Watchlist is stale, do full refresh
          console.log('[HomeScreen] 🔄 Full refresh (watchlist cache stale)');
          fetchUserData();
        } else {
          // Watchlist is fresh, only refresh stats (lightweight)
          console.log('[HomeScreen] ⚡ Quick refresh (stats only)');
          fetchUserStats();
        }
        
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
      // Shuffle helper function
      const shuffleArray = <T,>(array: T[]): T[] => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      };

      // Get watchlist IDs to exclude
      const excludeIds = new Set(
        watchlist.map(item => `${item.type}-${item.id}`)
      );

      console.log('[Surprise Me] Fetching fresh trending content...');
      
      // Always fetch fresh trending content for true randomness
      const [trendingMovies, trendingTV] = await Promise.all([
        tmdbService.getTrendingMovies(),
        tmdbService.getTrendingTVShows(),
      ]);

      console.log('[Surprise Me] Got', trendingMovies.length, 'movies and', trendingTV.length, 'TV shows');

      // Combine all trending content
      const allContent = [
        ...trendingMovies.map(m => ({ ...m, type: 'movie' as const })),
        ...trendingTV.map(t => ({ ...t, type: 'tv' as const })),
      ].filter(item => !excludeIds.has(`${item.type}-${item.id}`));

      console.log('[Surprise Me] Total available content after filtering:', allContent.length);

      if (allContent.length === 0) {
        Alert.alert('No Content', 'No content available for surprise selection');
        return;
      }

      // Shuffle the entire array and pick the first item
      const shuffled = shuffleArray(allContent);
      const selectedItem = shuffled[0];
      
      console.log('[Surprise Me] Selected:', selectedItem.type, selectedItem.id, 'title' in selectedItem ? selectedItem.title : selectedItem.name);
      
      // Navigate to detail screen
      router.push(`/details/${selectedItem.type}/${selectedItem.id}`);
    } catch (error) {
      console.error('Error in Surprise Me:', error);
      Alert.alert('Error', 'Failed to find a surprise recommendation. Please try again.');
    } finally {
      setSurpriseMeLoading(false);
    }
  }, [user, watchlist]);

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

      // Optimistic update: Increment episode count in Your Journey immediately
      if (userStats) {
        const updatedStats = {
          ...userStats,
          totalEpisodes: userStats.totalEpisodes + 1
        };
        setUserStats(updatedStats);
        // Cache the optimistic update
        await storageService.cacheUserStats(updatedStats);
      }

      // Mark as watched in background
      await progressService.markEpisodeWatched(item.id, season, episode);

      // Note: No manual refresh needed here!
      // The progressService.onProgressUpdate subscription will automatically:
      // 1. Refresh Continue Watching
      // 2. Refresh user stats
      // This prevents unnecessary watchlist refreshes
    } catch (error) {
      console.error('Error marking episode watched:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark episode as watched';
      Alert.alert("Error", `${errorMessage}. Please try again.`);
      // Revert optimistic update by refreshing stats only
      fetchUserStats().catch(err => {
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
        watchlistCacheTime.current = Date.now(); // Update cache timestamp
        
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
        watchlistCacheTime.current = Date.now(); // Update cache timestamp
        
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
      watchlistCacheTime.current = Date.now(); // Update cache timestamp

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
      
      // Refresh only stats (lightweight) instead of full user data
      await fetchUserStats();
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

  // Continue watching handlers - memoized to prevent unnecessary re-renders
  const handleContinueWatchingItemPress = useCallback((item: ContinueWatchingItem) => {
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
  }, []);

  const handleContinueWatchingRemove = useCallback(async (id: number, type: 'movie' | 'tv') => {
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
  }, []);

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

      {/* Contextual Recommendations Modal */}
      <ContextualRecommendationsModal
        visible={showContextualModal}
        onClose={() => setShowContextualModal(false)}
        genreIds={contextualGenres}
        mood={contextualMood}
        message={contextualMessage}
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
        {/* At a Glance Hero Section */}
        {userStats ? (
          <AtAGlanceHero
            stats={{
              currentStreak: userStats.currentStreak,
              totalEpisodes: userStats.totalEpisodes,
              totalSavings: userStats.totalSavings,
            }}
            loading={sectionLoadingStates['stats']}
            onPress={() => router.push('/recommendations')}
            onShowRecommendations={(genreIds, mood) => {
              setContextualGenres(genreIds);
              setContextualMood(mood);
              setContextualMessage(contextualMessagingService.getContextualMessage(userStats.currentStreak).message);
              setShowContextualModal(true);
            }}
          />
        ) : (
          <SkeletonLoader type="section" />
        )}

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
            style={styles.notificationButton}
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
    paddingHorizontal: 20,
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
    top: 0,
    right: 0,
  },
});