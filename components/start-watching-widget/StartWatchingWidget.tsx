import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '@/contexts/AuthContext';
import { RecommendationItem } from '@/types';
import { recommendationQueueService } from '@/services/recommendationQueueService';
import { swipeActionService } from '@/services/swipeActionService';
import { imageCacheService } from '@/services/imageCache';
import { SwipeableCard } from './SwipeableCard';
import { TransitionMessage } from './TransitionMessage';
import { EmptyState } from './EmptyState';

interface StartWatchingWidgetProps {
  onItemPress?: (item: RecommendationItem, type: 'movie' | 'tv') => void;
  refreshTrigger?: number;
}

interface WidgetState {
  cards: RecommendationItem[];
  phase: 'watchlist' | 'taste' | 'transition';
  dismissedIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  lastUpdate: string;
  isOffline: boolean; // Subtask 11.1: Track offline state
  retryCount: number; // Subtask 11.1: Track retry attempts
}

// Storage keys for state persistence (Subtask 11.4)
const STORAGE_KEY_PREFIX = '@start_watching_widget';
const DISMISSED_IDS_KEY = `${STORAGE_KEY_PREFIX}_dismissed_ids`;
const MAX_DISMISSED_IDS = 50; // Keep last 50 dismissed IDs (Requirement 5.10)

export const StartWatchingWidget: React.FC<StartWatchingWidgetProps> = ({
  onItemPress,
  refreshTrigger,
}) => {
  const router = useRouter();
  const { user, preferences } = useAuth();

  // Component state (Subtask 7.1)
  const [state, setState] = useState<WidgetState>({
    cards: [],
    phase: 'watchlist',
    dismissedIds: new Set<string>(),
    isLoading: true,
    error: null,
    lastUpdate: new Date().toISOString(),
    isOffline: false, // Subtask 11.1
    retryCount: 0, // Subtask 11.1
  });

  const [processingCardIndex, setProcessingCardIndex] = useState<number | null>(null);

  // Network monitoring (Subtask 11.1)
  const networkUnsubscribeRef = useRef<(() => void) | null>(null);
  const shouldRetryOnNetworkRef = useRef(false);

  // Action queue for debouncing rapid swipes (Subtask 10.3)
  const actionQueueRef = useRef<Array<() => Promise<void>>>([]);
  const isProcessingQueueRef = useRef(false);

  // Get subscribed services from preferences
  const subscribedServices = preferences?.subscribed_services || [];

  // Save dismissed IDs to storage (Subtask 11.4, Requirement 8.10)
  const saveDismissedIds = useCallback(async (dismissedIds: Set<string>) => {
    if (!user) return;

    try {
      const idsArray = Array.from(dismissedIds);
      // Keep only last MAX_DISMISSED_IDS entries (Requirement 5.10)
      const trimmedIds = idsArray.slice(-MAX_DISMISSED_IDS);
      const storageKey = `${DISMISSED_IDS_KEY}_${user.id}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(trimmedIds));
      console.log(`[StartWatchingWidget] Saved ${trimmedIds.length} dismissed IDs`);
    } catch (error) {
      console.error('[StartWatchingWidget] Error saving dismissed IDs:', error);
    }
  }, [user]);

  // Restore dismissed IDs from storage (Subtask 11.4, Requirement 8.10)
  const restoreDismissedIds = useCallback(async (): Promise<Set<string>> => {
    if (!user) return new Set();

    try {
      const storageKey = `${DISMISSED_IDS_KEY}_${user.id}`;
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const idsArray = JSON.parse(stored) as string[];
        console.log(`[StartWatchingWidget] Restored ${idsArray.length} dismissed IDs`);
        return new Set(idsArray);
      }
    } catch (error) {
      console.error('[StartWatchingWidget] Error restoring dismissed IDs:', error);
    }
    return new Set();
  }, [user]);

  // Restore state on mount (Subtask 11.4)
  useEffect(() => {
    const restoreState = async () => {
      const dismissedIds = await restoreDismissedIds();
      setState(prev => ({
        ...prev,
        dismissedIds,
      }));
    };

    restoreState();
  }, [restoreDismissedIds]);

  // Save dismissed IDs whenever they change (Subtask 11.4)
  useEffect(() => {
    if (state.dismissedIds.size > 0) {
      saveDismissedIds(state.dismissedIds);
    }
  }, [state.dismissedIds, saveDismissedIds]);

  // Process action queue sequentially (Subtask 10.3)
  const processActionQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || actionQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;

    try {
      while (actionQueueRef.current.length > 0) {
        const action = actionQueueRef.current.shift();
        if (action) {
          await action();
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, []);

  // Queue an action for sequential processing (Subtask 10.3)
  const queueAction = useCallback((action: () => Promise<void>) => {
    actionQueueRef.current.push(action);
    processActionQueue();
  }, [processActionQueue]);

  // Format relative timestamp (Subtask 7.6)
  // Memoized for performance (Subtask 10.4)
  const getRelativeTime = useCallback((timestamp: string): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just updated';
    if (diffMins < 60) return `Updated ${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Updated ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `Updated ${diffDays}d ago`;
  }, []);

  // Preload images for cards (Subtask 10.2)
  const preloadCardImages = useCallback((cards: RecommendationItem[]) => {
    const imageUrls = cards
      .filter(card => card.poster_path)
      .map(card => `https://image.tmdb.org/t/p/w500${card.poster_path}`);
    
    if (imageUrls.length > 0) {
      imageCacheService.preloadImages(imageUrls).catch(err =>
        console.error('Failed to preload images:', err)
      );
    }
  }, []);

  // Retry with exponential backoff (Subtask 11.1)
  // Requirements: 8.1
  const retryWithBackoff = useCallback(async <T,>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Check if offline before attempting
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) {
          throw new Error('No network connection');
        }

        return await fn();
      } catch (error) {
        lastError = error as Error;
        console.error(`[StartWatchingWidget] Attempt ${attempt + 1} failed:`, error);

        setState(prev => ({ ...prev, retryCount: attempt + 1 }));

        if (attempt < maxRetries - 1) {
          // Calculate exponential backoff delay: 1s, 2s, 4s
          const delay = 1000 * Math.pow(2, attempt);
          console.log(`[StartWatchingWidget] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }, []);

  // Load initial recommendations (Subtask 7.1, 11.1)
  const loadInitialRecommendations = useCallback(async () => {
    if (!user || subscribedServices.length === 0) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: null,
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null, retryCount: 0 }));

      // Use retry logic with exponential backoff (Subtask 11.1)
      const initialCards = await retryWithBackoff(async () => {
        return await recommendationQueueService.initializeQueue(
          user.id,
          subscribedServices
        );
      });

      // Preload images for initial cards (Subtask 10.2)
      preloadCardImages(initialCards);

      setState(prev => ({
        ...prev,
        cards: initialCards,
        phase: 'watchlist',
        isLoading: false,
        lastUpdate: new Date().toISOString(),
        retryCount: 0,
      }));
    } catch (error) {
      console.error('Error loading initial recommendations:', error);
      const errorMessage = state.isOffline 
        ? 'No network connection. Please check your internet.'
        : 'Failed to load recommendations. Please try again.';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        retryCount: 0,
      }));
    }
  }, [user, subscribedServices, preloadCardImages, retryWithBackoff, state.isOffline]);

  // Fetch next recommendation (Subtask 7.2, 11.2)
  const fetchNextRecommendation = useCallback(async (): Promise<RecommendationItem | null> => {
    if (!user) return null;

    try {
      // Create a set of IDs to exclude (dismissed + currently displayed)
      const excludeIds = new Set(state.dismissedIds);
      state.cards.forEach(card => {
        excludeIds.add(`${card.type}-${card.id}`);
      });
      
      const next = await recommendationQueueService.getNextRecommendation(
        user.id,
        subscribedServices,
        excludeIds
      );

      return next;
    } catch (error) {
      console.error('Error fetching next recommendation:', error);
      return null;
    }
  }, [user, subscribedServices, state.dismissedIds]);

  // Handle phase transition (Subtask 7.3)
  const handlePhaseTransition = useCallback(() => {
    // Show transition message
    setState(prev => ({ ...prev, phase: 'transition' }));

    // Wait 2 seconds before switching to taste phase
    setTimeout(async () => {
      setState(prev => ({ ...prev, phase: 'taste' }));

      // Fetch taste recommendations to fill empty slots
      if (!user) return;

      const newCards: RecommendationItem[] = [];
      for (let i = 0; i < 3; i++) {
        const next = await fetchNextRecommendation();
        if (next) newCards.push(next);
      }

      setState(prev => ({
        ...prev,
        cards: newCards,
        lastUpdate: new Date().toISOString(),
      }));
    }, 2000);
  }, [user, fetchNextRecommendation]);

  // Replace card at specific index (Subtask 7.2, 11.2)
  const replaceCard = useCallback(async (index: number) => {
    // Check if we should transition to taste phase
    if (recommendationQueueService.shouldTransitionToTaste() && state.phase === 'watchlist') {
      handlePhaseTransition();
      return;
    }

    // Fetch next recommendation
    const nextCard = await fetchNextRecommendation();

    if (nextCard) {
      // Preload image for new card (Subtask 10.2)
      if (nextCard.poster_path) {
        const imageUrl = `https://image.tmdb.org/t/p/w500${nextCard.poster_path}`;
        imageCacheService.preloadImage(imageUrl).catch(err =>
          console.error('Failed to preload image:', err)
        );
      }

      setState(prev => {
        const newCards = [...prev.cards];
        newCards[index] = nextCard;
        return {
          ...prev,
          cards: newCards,
          lastUpdate: new Date().toISOString(),
        };
      });
    } else {
      // No more cards available - remove this slot (Subtask 11.2, Requirement 8.5)
      // When last card is swiped, show "All caught up!" message
      setState(prev => {
        const newCards = prev.cards.filter((_, i) => i !== index);
        console.log(`[StartWatchingWidget] Removed card at index ${index}, ${newCards.length} cards remaining`);
        return {
          ...prev,
          cards: newCards,
        };
      });
    }
  }, [state.phase, fetchNextRecommendation, handlePhaseTransition]);

  // Handle swipe actions (Subtask 7.2, 10.3, 11.1)
  const handleSwipeRight = useCallback((card: RecommendationItem, index: number) => {
    if (!user) return;

    // Disable swipe actions when offline (Subtask 11.1, Requirement 8.3)
    if (state.isOffline) {
      console.log('[StartWatchingWidget] Swipe disabled - offline');
      setState(prev => ({
        ...prev,
        error: 'Cannot perform action while offline',
      }));
      return;
    }

    // Queue action to prevent race conditions (Subtask 10.3)
    queueAction(async () => {
      setProcessingCardIndex(index);

      try {
        await swipeActionService.markAsWatched(card, user.id);
        console.log('[StartWatchingWidget] Marked as watched, replacing card at index', index);
        
        // Replace card with next recommendation (for both movies and TV shows)
        await replaceCard(index);
      } catch (error) {
        console.error('Error marking as watched:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to mark as watched',
        }));
      } finally {
        setProcessingCardIndex(null);
      }
    });
  }, [user, replaceCard, queueAction, state.isOffline]);

  const handleSwipeLeft = useCallback((card: RecommendationItem, index: number) => {
    if (!user) return;

    // Disable swipe actions when offline (Subtask 11.1, Requirement 8.3)
    if (state.isOffline) {
      console.log('[StartWatchingWidget] Swipe disabled - offline');
      setState(prev => ({
        ...prev,
        error: 'Cannot perform action while offline',
      }));
      return;
    }

    // Queue action to prevent race conditions (Subtask 10.3)
    queueAction(async () => {
      setProcessingCardIndex(index);

      try {
        const dismissedId = await swipeActionService.dismissRecommendation(card, user.id);
        
        // Update dismissed IDs set (Subtask 11.4)
        // Keep only last MAX_DISMISSED_IDS entries (Requirement 5.10)
        setState(prev => {
          const newDismissedIds = new Set([...prev.dismissedIds, dismissedId]);
          
          // Trim to MAX_DISMISSED_IDS if needed
          if (newDismissedIds.size > MAX_DISMISSED_IDS) {
            const idsArray = Array.from(newDismissedIds);
            const trimmedArray = idsArray.slice(-MAX_DISMISSED_IDS);
            return {
              ...prev,
              dismissedIds: new Set(trimmedArray),
            };
          }
          
          return {
            ...prev,
            dismissedIds: newDismissedIds,
          };
        });

        await replaceCard(index);
      } catch (error) {
        console.error('Error dismissing recommendation:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to dismiss recommendation',
        }));
      } finally {
        setProcessingCardIndex(null);
      }
    });
  }, [user, replaceCard, queueAction, state.isOffline]);

  const handleSwipeUp = useCallback(async (card: RecommendationItem, index: number) => {
    if (!user) return;

    // Disable swipe actions when offline (Subtask 11.1, Requirement 8.3)
    if (state.isOffline) {
      console.log('[StartWatchingWidget] Swipe disabled - offline');
      setState(prev => ({
        ...prev,
        error: 'Cannot perform action while offline',
      }));
      return;
    }

    // For TV shows, show alert to choose action
    if (card.type === 'tv') {
      Alert.alert(
        'Remove TV Show',
        `What would you like to do with "${card.title}"?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Mark All Watched',
            onPress: () => {
              queueAction(async () => {
                setProcessingCardIndex(index);
                try {
                  await swipeActionService.removeFromWatchlist(card, user.id, 'mark-all-watched');
                  await replaceCard(index);
                } catch (error) {
                  console.error('Error marking all watched:', error);
                  setState(prev => ({
                    ...prev,
                    error: 'Failed to mark all watched',
                  }));
                } finally {
                  setProcessingCardIndex(null);
                }
              });
            },
          },
          {
            text: 'Remove from Watchlist',
            style: 'destructive',
            onPress: () => {
              queueAction(async () => {
                setProcessingCardIndex(index);
                try {
                  await swipeActionService.removeFromWatchlist(card, user.id, 'remove');
                  await replaceCard(index);
                } catch (error) {
                  console.error('Error removing from watchlist:', error);
                  setState(prev => ({
                    ...prev,
                    error: 'Failed to remove from watchlist',
                  }));
                } finally {
                  setProcessingCardIndex(null);
                }
              });
            },
          },
        ]
      );
    } else {
      // For movies, just remove from watchlist
      queueAction(async () => {
        setProcessingCardIndex(index);

        try {
          await swipeActionService.removeFromWatchlist(card, user.id);
          await replaceCard(index);
        } catch (error) {
          console.error('Error removing from watchlist:', error);
          setState(prev => ({
            ...prev,
            error: 'Failed to remove from watchlist',
          }));
        } finally {
          setProcessingCardIndex(null);
        }
      });
    }
  }, [user, replaceCard, queueAction, state.isOffline]);

  const handleCardPress = useCallback((card: RecommendationItem) => {
    if (onItemPress) {
      onItemPress(card, card.type);
    } else {
      // Default navigation to details page
      router.push(`/details/${card.type}/${card.id}`);
    }
  }, [onItemPress, router]);

  // Handle retry (Subtask 7.5)
  const handleRetry = useCallback(() => {
    loadInitialRecommendations();
  }, [loadInitialRecommendations]);

  // Handle transition message dismiss (Subtask 7.3)
  const handleTransitionDismiss = useCallback(() => {
    // Transition is handled automatically by timeout
  }, []);

  // Handle retry when network is restored (Subtask 11.1)
  useEffect(() => {
    if (!state.isOffline && shouldRetryOnNetworkRef.current && state.error) {
      console.log('[StartWatchingWidget] Network restored, retrying...');
      shouldRetryOnNetworkRef.current = false;
      loadInitialRecommendations();
    }
  }, [state.isOffline, state.error, loadInitialRecommendations]);

  // Setup network monitoring (Subtask 11.1)
  useEffect(() => {
    const setupNetworkMonitoring = async () => {
      // Check initial network state
      const netInfo = await NetInfo.fetch();
      setState(prev => ({
        ...prev,
        isOffline: !netInfo.isConnected,
      }));

      // Subscribe to network state changes
      networkUnsubscribeRef.current = NetInfo.addEventListener(netState => {
        const isOffline = !netState.isConnected;
        setState(prev => {
          // Only update if state changed
          if (prev.isOffline !== isOffline) {
            console.log(`[StartWatchingWidget] Network state changed: ${isOffline ? 'offline' : 'online'}`);
            
            // If coming back online and had an error, mark for retry
            if (!isOffline && prev.error) {
              shouldRetryOnNetworkRef.current = true;
            }
            
            return { ...prev, isOffline };
          }
          return prev;
        });
      });
    };

    setupNetworkMonitoring();

    // Cleanup network listener
    return () => {
      if (networkUnsubscribeRef.current) {
        networkUnsubscribeRef.current();
        networkUnsubscribeRef.current = null;
      }
    };
  }, []); // Empty deps - only setup once

  // Initialize on mount and when refreshTrigger changes
  useEffect(() => {
    loadInitialRecommendations();
  }, [loadInitialRecommendations, refreshTrigger]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear action queue
      actionQueueRef.current = [];
      isProcessingQueueRef.current = false;
      
      // Clear recommendation queue service
      recommendationQueueService.clear();
    };
  }, []);

  // Calculate relative time (must be before any early returns to follow Rules of Hooks)
  const relativeTime = useMemo(() => getRelativeTime(state.lastUpdate), [state.lastUpdate, getRelativeTime]);

  // Render empty states (Subtask 7.5)
  if (!user) {
    return null;
  }

  if (subscribedServices.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState type="no_subscriptions" />
      </View>
    );
  }

  if (state.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="tv" size={24} color="#fff" />
            <Text style={styles.title}>Start Watching</Text>
            <ActivityIndicator size="small" color="#fff" style={styles.loadingSpinner} />
          </View>
          <Text style={styles.subtitle}>Pick your next show</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </View>
    );
  }

  if (state.error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="tv" size={24} color="#fff" />
            <Text style={styles.title}>Start Watching</Text>
          </View>
          <Text style={styles.subtitle}>Pick your next show</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{state.error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (state.cards.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="tv" size={24} color="#fff" />
            <Text style={styles.title}>Start Watching</Text>
          </View>
          <Text style={styles.subtitle}>Pick your next show</Text>
        </View>
        <EmptyState type="all_caught_up" />
      </View>
    );
  }

  // Show transition message (Subtask 7.3)
  if (state.phase === 'transition') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="tv" size={24} color="#fff" />
            <Text style={styles.title}>Start Watching</Text>
          </View>
          <Text style={styles.subtitle}>Pick your next show</Text>
        </View>
        <TransitionMessage onDismiss={handleTransitionDismiss} />
      </View>
    );
  }

  // Render widget with cards (Subtask 7.4, 7.6)
  return (
    <View style={styles.container}>
      {/* Widget Header (Subtask 7.6) */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="tv" size={24} color="#fff" />
          <Text style={styles.title}>Start Watching</Text>
          {/* Offline indicator (Subtask 11.1, Requirement 8.3) */}
          {state.isOffline && (
            <View style={styles.offlineIndicator}>
              <Ionicons name="cloud-offline" size={16} color="#ff6b6b" />
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
        </View>
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>Pick your next show</Text>
          <TouchableOpacity onPress={() => router.push('/recommendations')}>
            <Text style={styles.viewAllLink}>View All</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.timestamp}>
          {relativeTime}
        </Text>
      </View>

      {/* Horizontal Card Layout (Subtask 7.4) */}
      <View 
        style={styles.cardsContainer}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
      >
        {state.cards.map((card, index) => (
          <SwipeableCard
            key={`${card.type}-${card.id}-${index}`}
            item={card}
            index={index}
            onSwipeRight={() => handleSwipeRight(card, index)}
            onSwipeLeft={() => handleSwipeLeft(card, index)}
            onSwipeUp={() => handleSwipeUp(card, index)}
            onPress={() => handleCardPress(card)}
            disabled={processingCardIndex !== null || isProcessingQueueRef.current || state.isOffline}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  loadingSpinner: {
    marginLeft: 8,
  },
  subtitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
  },
  viewAllLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  loadingContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 12,
  },
  offlineText: {
    color: '#ff6b6b',
    fontSize: 12,
    fontWeight: '600',
  },
});
