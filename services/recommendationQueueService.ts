import { supabase } from './supabase';
import { tmdbService } from './tmdb';
import { tasteProfileService } from './tasteProfileService';
import { RecommendationItem, TasteProfile } from '../types';

class RecommendationQueueService {
  private watchlistQueue: RecommendationItem[] = [];
  private tasteQueue: RecommendationItem[] = [];
  private currentPhase: 'watchlist' | 'taste' = 'watchlist';
  private isLoadingWatchlist = false;
  private isLoadingTaste = false;

  // Batch size for fetching recommendations
  private readonly WATCHLIST_BATCH_SIZE = 10;
  private readonly TASTE_BATCH_SIZE = 15;

  // Prefetch cache (Subtask 10.1)
  private prefetchCache: Map<string, RecommendationItem> = new Map();
  private readonly PREFETCH_LIMIT = 2; // Limit prefetch to 2 items ahead
  private prefetchPromise: Promise<void> | null = null;

  /**
   * Initialize queue with watchlist recommendations
   * Requirements: 2.1, 2.6
   * Subtask 11.2: Filter duplicates before displaying
   */
  async initializeQueue(
    userId: string,
    subscribedServices: string[]
  ): Promise<RecommendationItem[]> {
    try {
      console.log('[RecommendationQueue] Initializing queue for user:', userId);
      console.log('[RecommendationQueue] Subscribed services:', subscribedServices);
      
      // Reset state
      this.watchlistQueue = [];
      this.tasteQueue = [];
      this.currentPhase = 'watchlist';
      this.prefetchCache.clear();

      // Load initial batch of watchlist items
      await this.loadWatchlistBatch(userId, subscribedServices);

      console.log('[RecommendationQueue] Watchlist queue length after load:', this.watchlistQueue.length);

      // If watchlist is empty, immediately transition to taste phase
      if (this.watchlistQueue.length === 0) {
        console.log('[RecommendationQueue] Watchlist empty, transitioning to taste phase');
        this.currentPhase = 'taste';
        
        // Load taste-based recommendations
        await this.loadTasteBatch(userId, subscribedServices, new Set());
        
        console.log('[RecommendationQueue] Taste queue length after load:', this.tasteQueue.length);
        
        // Return first 3 items from taste queue
        const itemCount = Math.min(3, this.tasteQueue.length);
        const items = this.getNextItemsFromTaste(itemCount);
        
        console.log('[RecommendationQueue] Returning', items.length, 'taste-based items for initial display');
        
        return items;
      }

      // Return first 3 items for display (or fewer if less available)
      // Subtask 11.2: Handle cases with only 1-2 items (Requirement 8.6)
      const itemCount = Math.min(3, this.watchlistQueue.length);
      const items = this.getNextItems(itemCount);
      
      console.log('[RecommendationQueue] Returning', items.length, 'items for initial display');
      
      return items;
    } catch (error) {
      console.error('Error initializing queue:', error);
      return [];
    }
  }

  /**
   * Get next recommendation based on current phase
   * Requirements: 2.2, 3.2, 3.3
   * Subtask 10.1: Added prefetching for instant replacement
   */
  async getNextRecommendation(
    userId: string,
    subscribedServices: string[],
    dismissedIds: Set<string>
  ): Promise<RecommendationItem | null> {
    try {
      // Check prefetch cache first for instant result (Subtask 10.1)
      const cachedItem = this.getFromPrefetchCache(dismissedIds);
      if (cachedItem) {
        // Trigger background prefetch to refill cache
        this.prefetchNextRecommendations(userId, subscribedServices, dismissedIds);
        return cachedItem;
      }

      if (this.currentPhase === 'watchlist') {
        // Try to get from watchlist queue
        const next = this.getNextFromWatchlist(dismissedIds);
        
        if (next) {
          // Preload more if queue is running low
          if (this.watchlistQueue.length < 3 && !this.isLoadingWatchlist) {
            this.loadWatchlistBatch(userId, subscribedServices).catch(err =>
              console.error('Background watchlist load failed:', err)
            );
          }
          // Prefetch next recommendations in background (Subtask 10.1)
          this.prefetchNextRecommendations(userId, subscribedServices, dismissedIds);
          return next;
        }

        // Watchlist exhausted, check if we should transition
        if (this.shouldTransitionToTaste()) {
          this.currentPhase = 'taste';
          // Load initial taste batch
          await this.loadTasteBatch(userId, subscribedServices, dismissedIds);
          const tasteNext = this.getNextFromTaste(dismissedIds);
          // Prefetch next recommendations in background (Subtask 10.1)
          if (tasteNext) {
            this.prefetchNextRecommendations(userId, subscribedServices, dismissedIds);
          }
          return tasteNext;
        }

        return null;
      } else {
        // Get from taste queue
        const next = this.getNextFromTaste(dismissedIds);

        if (next) {
          // Preload more if queue is running low
          if (this.tasteQueue.length < 3 && !this.isLoadingTaste) {
            this.loadTasteBatch(userId, subscribedServices, dismissedIds).catch(err =>
              console.error('Background taste load failed:', err)
            );
          }
          // Prefetch next recommendations in background (Subtask 10.1)
          this.prefetchNextRecommendations(userId, subscribedServices, dismissedIds);
          return next;
        }

        // Try to load more taste recommendations
        await this.loadTasteBatch(userId, subscribedServices, dismissedIds);
        const tasteNext = this.getNextFromTaste(dismissedIds);
        // Prefetch next recommendations in background (Subtask 10.1)
        if (tasteNext) {
          this.prefetchNextRecommendations(userId, subscribedServices, dismissedIds);
        }
        return tasteNext;
      }
    } catch (error) {
      console.error('Error getting next recommendation:', error);
      return null;
    }
  }

  /**
   * Check if should transition to taste phase
   * Requirements: 2.5, 3.8
   */
  shouldTransitionToTaste(): boolean {
    return this.currentPhase === 'watchlist' && 
           this.watchlistQueue.length === 0 && 
           !this.isLoadingWatchlist;
  }

  /**
   * Get current phase
   */
  getCurrentPhase(): 'watchlist' | 'taste' {
    return this.currentPhase;
  }

  /**
   * Clear all queues (useful for refresh)
   */
  clear(): void {
    this.watchlistQueue = [];
    this.tasteQueue = [];
    this.currentPhase = 'watchlist';
    this.isLoadingWatchlist = false;
    this.isLoadingTaste = false;
    this.prefetchCache.clear(); // Clear prefetch cache (Subtask 10.1)
    this.prefetchPromise = null;
  }

  /**
   * Get queue status for debugging
   */
  getQueueStatus(): {
    watchlistCount: number;
    tasteCount: number;
    currentPhase: 'watchlist' | 'taste';
    isLoading: boolean;
  } {
    return {
      watchlistCount: this.watchlistQueue.length,
      tasteCount: this.tasteQueue.length,
      currentPhase: this.currentPhase,
      isLoading: this.isLoadingWatchlist || this.isLoadingTaste,
    };
  }

  // ===== Private Helper Methods =====

  /**
   * Load a batch of watchlist items
   */
  private async loadWatchlistBatch(
    userId: string,
    subscribedServices: string[]
  ): Promise<void> {
    if (this.isLoadingWatchlist) return;

    this.isLoadingWatchlist = true;

    try {
      // Get watchlist items that haven't been started yet
      // For the Start Watching Widget, we only want 'plan_to_watch' status
      // Once a show is marked as 'watching', it should be removed from this widget
      const { data: watchlistData, error } = await supabase
        .from('watchlists')
        .select('tmdb_id, media_type')
        .eq('user_id', userId)
        .eq('status', 'plan_to_watch') // Only show items that haven't been started
        .limit(this.WATCHLIST_BATCH_SIZE * 2); // Fetch more since we'll filter

      if (error) throw error;

      console.log(`[RecommendationQueue] Loaded ${watchlistData?.length || 0} watchlist items from database`);

      if (!watchlistData || watchlistData.length === 0) {
        console.log('[RecommendationQueue] No watchlist items found');
        return;
      }

      // All items from the query are already 'plan_to_watch' status
      // No need for additional filtering - just separate by type for logging
      const tvShows = watchlistData.filter(item => item.media_type === 'tv');
      const movies = watchlistData.filter(item => item.media_type === 'movie');
      
      console.log(`[RecommendationQueue] Unstarted TV shows:`, tvShows.map(s => s.tmdb_id));
      console.log(`[RecommendationQueue] Unstarted movies:`, movies.map(m => m.tmdb_id));
      
      // Combine all unstarted items
      const unstartedItems = [...tvShows, ...movies];
      
      if (unstartedItems.length === 0) {
        console.log('[RecommendationQueue] No unstarted items found');
        return;
      }

      // Fetch details and filter by subscribed services
      const items = await this.fetchWatchlistDetails(
        unstartedItems,
        subscribedServices
      );

      console.log(`[RecommendationQueue] Fetched ${items.length} items after filtering by subscribed services`);
      console.log(`[RecommendationQueue] Subscribed services:`, subscribedServices);

      // Shuffle for variety
      const shuffled = this.shuffleArray(items);

      // Add to queue (avoid duplicates)
      const existingIds = new Set(this.watchlistQueue.map(i => `${i.type}-${i.id}`));
      const newItems = shuffled.filter(
        item => !existingIds.has(`${item.type}-${item.id}`)
      );

      this.watchlistQueue.push(...newItems);
    } catch (error) {
      console.error('Error loading watchlist batch:', error);
    } finally {
      this.isLoadingWatchlist = false;
    }
  }

  /**
   * Load a batch of taste-based recommendations
   */
  private async loadTasteBatch(
    userId: string,
    subscribedServices: string[],
    dismissedIds: Set<string>
  ): Promise<void> {
    if (this.isLoadingTaste) {
      console.log('[RecommendationQueue] Already loading taste batch, skipping');
      return;
    }

    this.isLoadingTaste = true;
    console.log('[RecommendationQueue] Loading taste batch...');
    console.log('[RecommendationQueue] Subscribed services:', subscribedServices);
    console.log('[RecommendationQueue] Dismissed IDs count:', dismissedIds.size);

    try {
      // Build taste profile
      console.log('[RecommendationQueue] Building taste profile...');
      const profile = await tasteProfileService.buildTasteProfile(userId);
      console.log('[RecommendationQueue] Taste profile built:', {
        favoriteGenres: profile.favoriteGenres.length,
        contentTypePreference: profile.contentTypePreference,
      });

      // Generate recommendations
      console.log('[RecommendationQueue] Generating taste recommendations...');
      const recommendations = await tasteProfileService.generateTasteRecommendations(
        profile,
        subscribedServices,
        dismissedIds,
        this.TASTE_BATCH_SIZE
      );
      console.log('[RecommendationQueue] Generated', recommendations.length, 'taste recommendations');

      // Add to queue (avoid duplicates)
      const existingIds = new Set(this.tasteQueue.map(i => `${i.type}-${i.id}`));
      const newItems = recommendations.filter(
        item => !existingIds.has(`${item.type}-${item.id}`)
      );

      this.tasteQueue.push(...newItems);
      console.log('[RecommendationQueue] Added', newItems.length, 'new items to taste queue. Total:', this.tasteQueue.length);
    } catch (error) {
      console.error('[RecommendationQueue] Error loading taste batch:', error);
    } finally {
      this.isLoadingTaste = false;
    }
  }

  /**
   * Fetch details for watchlist items
   * Subtask 11.2: Filter out duplicates (Requirement 8.7)
   */
  private async fetchWatchlistDetails(
    watchlistData: any[],
    subscribedServices: string[]
  ): Promise<RecommendationItem[]> {
    const items: RecommendationItem[] = [];
    const seenIds = new Set<string>(); // Track seen IDs to filter duplicates

    // Fetch details in parallel
    const promises = watchlistData.map(async item => {
      try {
        const type = item.media_type as 'movie' | 'tv';
        const itemId = `${type}-${item.tmdb_id}`;
        
        // Filter duplicates (Subtask 11.2, Requirement 8.7)
        if (seenIds.has(itemId)) {
          console.log(`[RecommendationQueue] Filtering duplicate: ${itemId}`);
          return null;
        }
        seenIds.add(itemId);
        
        // Fetch TMDB details
        let details;
        if (type === 'movie') {
          details = await tmdbService.getMovieDetails(item.tmdb_id);
        } else {
          details = await tmdbService.getTVShowDetails(item.tmdb_id);
        }

        // Get streaming providers
        const providers = await tmdbService.getWatchProviders(item.tmdb_id, type);
        
        console.log(`[RecommendationQueue] ${type} ${item.tmdb_id} providers:`, providers.map(p => `${p.service.name} (${p.service.id})`));
        console.log(`[RecommendationQueue] Subscribed services:`, subscribedServices);
        
        // Check if available on subscribed services
        // Support both provider ID and provider name matching for flexibility
        const matchingProvider = providers.find(p => {
          // Direct ID match
          if (subscribedServices.includes(p.service.id)) return true;
          
          // Fuzzy name matching for common providers
          const providerNameLower = p.service.name?.toLowerCase() || '';
          return subscribedServices.some(sub => {
            const subLower = sub.toLowerCase();
            // Match "amazon" with "Amazon Video" or "Amazon Prime Video"
            if (subLower === 'amazon' && providerNameLower.includes('amazon')) return true;
            // Match "netflix" with "Netflix"
            if (subLower === 'netflix' && providerNameLower.includes('netflix')) return true;
            // Match "hbo" with "HBO Max"
            if (subLower === 'hbo' && providerNameLower.includes('hbo')) return true;
            // Match "disney" with "Disney Plus"
            if (subLower === 'disney' && providerNameLower.includes('disney')) return true;
            return false;
          });
        });

        if (!matchingProvider) {
          console.log(`[RecommendationQueue] No matching provider for ${type} ${item.tmdb_id} - filtering out`);
          return null;
        }
        
        console.log(`[RecommendationQueue] Matched provider: ${matchingProvider.service.name} (${matchingProvider.service.id})`);

        const recommendationItem: RecommendationItem = {
          id: item.tmdb_id,
          type,
          title: type === 'movie' ? (details as any).title : (details as any).name,
          poster_path: details.poster_path,
          vote_average: details.vote_average,
          providerName: matchingProvider.service.name,
          providerLogoUrl: matchingProvider.service.imageSet?.darkThemeImage,
          source: 'watchlist' as const,
          genres: details.genre_ids || [],
        };

        if (type === 'movie') {
          recommendationItem.release_date = (details as any).release_date;
        } else {
          recommendationItem.first_air_date = (details as any).first_air_date;
        }

        return recommendationItem;
      } catch (error) {
        console.error(`Error fetching details for ${item.media_type} ${item.tmdb_id}:`, error);
        return null;
      }
    });

    const results = await Promise.all(promises);
    items.push(...results.filter((item): item is RecommendationItem => item !== null));

    return items;
  }

  /**
   * Get next item from watchlist queue
   */
  private getNextFromWatchlist(dismissedIds: Set<string>): RecommendationItem | null {
    // Find first non-dismissed item
    const index = this.watchlistQueue.findIndex(
      item => !dismissedIds.has(`${item.type}-${item.id}`)
    );

    if (index === -1) return null;

    // Remove and return the item
    const [item] = this.watchlistQueue.splice(index, 1);
    return item;
  }

  /**
   * Get next item from taste queue
   */
  private getNextFromTaste(dismissedIds: Set<string>): RecommendationItem | null {
    // Find first non-dismissed item
    const index = this.tasteQueue.findIndex(
      item => !dismissedIds.has(`${item.type}-${item.id}`)
    );

    if (index === -1) return null;

    // Remove and return the item
    const [item] = this.tasteQueue.splice(index, 1);
    return item;
  }

  /**
   * Get multiple items from queue
   */
  private getNextItems(count: number): RecommendationItem[] {
    const items: RecommendationItem[] = [];
    
    for (let i = 0; i < count && this.watchlistQueue.length > 0; i++) {
      const item = this.watchlistQueue.shift();
      if (item) items.push(item);
    }

    return items;
  }

  /**
   * Get multiple items from taste queue
   */
  private getNextItemsFromTaste(count: number): RecommendationItem[] {
    const items: RecommendationItem[] = [];
    
    for (let i = 0; i < count && this.tasteQueue.length > 0; i++) {
      const item = this.tasteQueue.shift();
      if (item) items.push(item);
    }

    return items;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Prefetch next recommendations in background (Subtask 10.1)
   * Fetches up to PREFETCH_LIMIT items ahead and caches them for instant replacement
   * Requirements: 7.4, 7.8
   */
  private prefetchNextRecommendations(
    userId: string,
    subscribedServices: string[],
    dismissedIds: Set<string>
  ): void {
    // Don't start new prefetch if one is already in progress
    if (this.prefetchPromise) return;

    // Don't prefetch if cache is already full
    if (this.prefetchCache.size >= this.PREFETCH_LIMIT) return;

    this.prefetchPromise = (async () => {
      try {
        const itemsToFetch = this.PREFETCH_LIMIT - this.prefetchCache.size;

        for (let i = 0; i < itemsToFetch; i++) {
          let nextItem: RecommendationItem | null = null;

          if (this.currentPhase === 'watchlist') {
            nextItem = this.peekNextFromWatchlist(dismissedIds);
            
            // If no more watchlist items, check if we should transition
            if (!nextItem && this.shouldTransitionToTaste()) {
              // Don't actually transition, just peek from taste queue
              await this.loadTasteBatch(userId, subscribedServices, dismissedIds);
              nextItem = this.peekNextFromTaste(dismissedIds);
            }
          } else {
            nextItem = this.peekNextFromTaste(dismissedIds);
            
            // Load more if needed
            if (!nextItem) {
              await this.loadTasteBatch(userId, subscribedServices, dismissedIds);
              nextItem = this.peekNextFromTaste(dismissedIds);
            }
          }

          if (nextItem) {
            const cacheKey = `${nextItem.type}-${nextItem.id}`;
            this.prefetchCache.set(cacheKey, nextItem);
          } else {
            break; // No more items available
          }
        }
      } catch (error) {
        console.error('Error prefetching recommendations:', error);
      } finally {
        this.prefetchPromise = null;
      }
    })();
  }

  /**
   * Get item from prefetch cache (Subtask 10.1)
   */
  private getFromPrefetchCache(dismissedIds: Set<string>): RecommendationItem | null {
    // Find first non-dismissed item in cache
    for (const [key, item] of this.prefetchCache.entries()) {
      if (!dismissedIds.has(`${item.type}-${item.id}`)) {
        this.prefetchCache.delete(key);
        return item;
      }
    }
    return null;
  }

  /**
   * Peek at next item from watchlist without removing it (Subtask 10.1)
   */
  private peekNextFromWatchlist(dismissedIds: Set<string>): RecommendationItem | null {
    const index = this.watchlistQueue.findIndex(
      item => !dismissedIds.has(`${item.type}-${item.id}`)
    );
    return index !== -1 ? this.watchlistQueue[index] : null;
  }

  /**
   * Peek at next item from taste queue without removing it (Subtask 10.1)
   */
  private peekNextFromTaste(dismissedIds: Set<string>): RecommendationItem | null {
    const index = this.tasteQueue.findIndex(
      item => !dismissedIds.has(`${item.type}-${item.id}`)
    );
    return index !== -1 ? this.tasteQueue[index] : null;
  }
}

export const recommendationQueueService = new RecommendationQueueService();
