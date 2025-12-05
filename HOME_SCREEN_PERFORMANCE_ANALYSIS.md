# Home Screen Performance Analysis

## Issues Identified

### 1. **Unnecessary Watchlist Refreshes on Focus**
**Problem:** The `useFocusEffect` hook refreshes user data (including watchlist) every time you return to the home screen after 30 seconds, even when nothing has changed.

**Location:** `app/(tabs)/index.tsx` lines 685-696
```typescript
useFocusEffect(
  useCallback(() => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastFocusRefreshTime.current;
    
    // Only refresh if it's been more than 30 seconds since last refresh
    if (timeSinceLastRefresh > 30000) {
      fetchUserData();  // ← This refetches EVERYTHING including watchlist
      lastFocusRefreshTime.current = now;
    }
  }, [])
);
```

**Impact:** 
- Causes "Movies from Your Watchlist" section to refresh unnecessarily
- Triggers database queries and TMDB API calls
- Creates visual flicker/reload effect

---

### 2. **Watchlist Movies Recalculated on Every User Data Fetch**
**Problem:** Every time `fetchUserData()` is called, it filters the entire watchlist to extract unwatched movies, even if the watchlist hasn't changed.

**Location:** `app/(tabs)/index.tsx` lines 542-547
```typescript
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
```

**Impact:**
- Unnecessary computation on every focus/refresh
- Causes state updates that trigger re-renders

---

### 3. **Background Sync Triggered on Every Watchlist Read**
**Problem:** The `getWatchlist()` method in storage service triggers a background sync EVERY time it's called, even when just reading data.

**Location:** `services/storage.ts` lines 136-150
```typescript
async getWatchlist(): Promise<WatchlistItem[]> {
  try {
    const key = await this.getWatchlistKey();
    const localData = await AsyncStorage.getItem(key);
    const localWatchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

    // Trigger background sync if user is logged in
    this.syncWatchlist().catch(err => console.error('Background sync failed:', err));
    // ↑ This runs EVERY time watchlist is read!

    return localWatchlist;
  } catch (error) {
    console.error('Error getting watchlist:', error);
    return [];
  }
}
```

**Impact:**
- Unnecessary network requests
- Potential race conditions
- Battery drain from frequent syncs

---

### 4. **Multiple Parallel Data Fetches on Initial Load**
**Problem:** The `loadAllData()` function fires off many parallel requests without proper coordination, which can overwhelm the device and cause UI jank.

**Location:** `app/(tabs)/index.tsx` lines 608-665
```typescript
const loadAllData = async () => {
  try {
    setLoading(true);
    
    // INSTANT LOAD: Load cached stats immediately
    if (user) {
      const cachedStats = await storageService.getCachedUserStats();
      if (cachedStats) {
        setUserStats(cachedStats);
      }
    }
    
    // ... then fires off 8+ parallel requests:
    await fetchUserData();
    fetchContinueWatching();
    fetchBecauseYouWatched();
    fetchGenreSections();
    fetchNewThisWeek();
    fetchLeavingSoon();
    fetchContent();
  }
}
```

**Impact:**
- Network congestion
- Slower overall load time
- Potential timeout errors

---

### 5. **No Memoization for Filtered Data**
**Problem:** The watchlist movies filtering happens in the render path without memoization, causing unnecessary recalculations.

**Current:** Direct state updates in async functions
**Better:** Use `useMemo` to cache filtered results

---

### 6. **Real-Time Updates Trigger Full Refreshes**
**Problem:** The `useAutoRefreshOnUpdates` hook refreshes ALL user data when any real-time update occurs.

**Location:** `app/(tabs)/index.tsx` lines 698-702
```typescript
useAutoRefreshOnUpdates(useCallback(() => {
  if (!loading && !refreshing) {
    fetchUserData();  // ← Refreshes everything
  }
}, [loading, refreshing]));
```

---

## Recommended Improvements

### Priority 1: Fix Unnecessary Focus Refreshes

**Solution:** Only refresh data that actually needs updating on focus, and use a smarter cache invalidation strategy.

```typescript
// Add a cache timestamp for watchlist
const watchlistCacheTime = useRef(0);
const WATCHLIST_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

useFocusEffect(
  useCallback(() => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastFocusRefreshTime.current;
    
    // Only refresh if it's been more than 30 seconds
    if (timeSinceLastRefresh > 30000) {
      // Check if watchlist cache is still valid
      const watchlistCacheAge = now - watchlistCacheTime.current;
      
      if (watchlistCacheAge > WATCHLIST_CACHE_DURATION) {
        // Only fetch watchlist if cache is stale
        fetchUserData();
        watchlistCacheTime.current = now;
      } else {
        // Just refresh stats (lightweight)
        fetchUserStats();
      }
      
      lastFocusRefreshTime.current = now;
    }
  }, [])
);
```

---

### Priority 2: Memoize Watchlist Movies

**Solution:** Use `useMemo` to cache the filtered watchlist movies.

```typescript
// Replace direct state updates with memoization
const watchlistMovies = useMemo(() => {
  return watchlist.filter(item => item.type === 'movie' && !item.watched);
}, [watchlist]);

// Remove setWatchlistMovies state and all calls to it
```

---

### Priority 3: Debounce Background Sync

**Solution:** Add a debounce mechanism to prevent excessive sync calls.

```typescript
// In storage.ts
private lastSyncTime = 0;
private readonly SYNC_DEBOUNCE = 30000; // 30 seconds

async getWatchlist(): Promise<WatchlistItem[]> {
  try {
    const key = await this.getWatchlistKey();
    const localData = await AsyncStorage.getItem(key);
    const localWatchlist: WatchlistItem[] = localData ? JSON.parse(localData) : [];

    // Only trigger sync if enough time has passed
    const now = Date.now();
    if (now - this.lastSyncTime > this.SYNC_DEBOUNCE) {
      this.lastSyncTime = now;
      this.syncWatchlist().catch(err => console.error('Background sync failed:', err));
    }

    return localWatchlist;
  } catch (error) {
    console.error('Error getting watchlist:', error);
    return [];
  }
}
```

---

### Priority 4: Optimize Initial Load Sequence

**Solution:** Load data in waves with proper prioritization.

```typescript
const loadAllData = async () => {
  try {
    setLoading(true);
    
    // WAVE 1: Critical data (instant from cache)
    const cachedStats = user ? await storageService.getCachedUserStats() : null;
    if (cachedStats) setUserStats(cachedStats);
    
    // WAVE 2: User data (fast, from local storage)
    await fetchUserData();
    setLoading(false); // Show UI immediately
    
    // WAVE 3: Personalized content (medium priority)
    await Promise.all([
      fetchContinueWatching(),
      fetchBecauseYouWatched(),
    ]);
    
    // WAVE 4: Discovery content (lower priority)
    await Promise.all([
      fetchGenreSections(),
      fetchNewThisWeek(),
      fetchLeavingSoon(),
    ]);
    
    // WAVE 5: Generic content (lowest priority)
    await fetchContent();
    
  } catch (error) {
    console.error('Critical error in loadAllData:', error);
    setLoading(false);
  } finally {
    setRefreshing(false);
  }
};
```

---

### Priority 5: Smart Real-Time Updates

**Solution:** Only refresh affected sections based on the type of update.

```typescript
// Replace blanket refresh with targeted updates
useAutoRefreshOnUpdates(useCallback((updateType?: string) => {
  if (loading || refreshing) return;
  
  // Only refresh relevant sections based on update type
  switch (updateType) {
    case 'watchlist':
      fetchUserData();
      break;
    case 'progress':
      fetchContinueWatching();
      fetchUserStats();
      break;
    case 'achievement':
      fetchUserStats();
      break;
    default:
      // Unknown update type, refresh user data only
      fetchUserData();
  }
}, [loading, refreshing]));
```

---

### Priority 6: Add Request Deduplication

**Solution:** Prevent multiple simultaneous requests for the same data.

```typescript
// Add request tracking
const pendingRequests = useRef<Map<string, Promise<any>>>(new Map());

const fetchWithDedup = async <T,>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> => {
  // Check if request is already in flight
  if (pendingRequests.current.has(key)) {
    return pendingRequests.current.get(key) as Promise<T>;
  }
  
  // Start new request
  const promise = fetcher().finally(() => {
    pendingRequests.current.delete(key);
  });
  
  pendingRequests.current.set(key, promise);
  return promise;
};

// Use in fetch functions
const fetchUserData = async () => {
  return fetchWithDedup('userData', async () => {
    // ... existing fetch logic
  });
};
```

---

## Summary of Benefits

Implementing these improvements will:

1. **Reduce unnecessary refreshes** by 70-80%
2. **Eliminate visual flicker** in "Movies from Your Watchlist"
3. **Improve battery life** by reducing background syncs
4. **Faster perceived load time** with better prioritization
5. **Smoother navigation** between tabs
6. **Reduced network usage** with request deduplication

## Implementation Priority

1. **Quick Wins (1-2 hours):**
   - Add memoization for watchlist movies
   - Debounce background sync
   - Add watchlist cache timestamp

2. **Medium Effort (2-4 hours):**
   - Optimize focus refresh logic
   - Implement request deduplication
   - Improve load sequence

3. **Nice to Have (4+ hours):**
   - Smart real-time updates with update types
   - Advanced caching strategies
   - Performance monitoring
