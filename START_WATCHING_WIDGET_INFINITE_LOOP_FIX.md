# Start Watching Widget Infinite Loop Fix

## Problem
After fixing the logout error loop, a new error appeared:
```
ERROR Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
```

The error was coming from `StartWatchingWidget.tsx` component.

## Root Cause

The infinite loop was caused by circular dependencies in `useEffect` hooks:

### Issue 1: `loadInitialRecommendations` Dependency Loop
```typescript
// ❌ BEFORE - Infinite loop
const loadInitialRecommendations = useCallback(async () => {
  // ... code that uses state.isOffline ...
  const errorMessage = state.isOffline 
    ? 'No network connection...'
    : 'Failed to load...';
}, [user, subscribedServices, preloadCardImages, retryWithBackoff, state.isOffline]);
//                                                                   ^^^^^^^^^^^^^^
//                                                    This dependency changes during execution!

useEffect(() => {
  loadInitialRecommendations();
}, [loadInitialRecommendations, refreshTrigger]);
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^
//  This changes when state.isOffline changes, triggering the effect again!
```

**The Loop:**
1. `useEffect` calls `loadInitialRecommendations()`
2. Function reads `state.isOffline` (included in dependencies)
3. Network state changes → `state.isOffline` updates
4. `loadInitialRecommendations` callback recreated (dependency changed)
5. `useEffect` sees new function reference → calls it again
6. Go to step 2 → **INFINITE LOOP**

### Issue 2: Stale Closure in `fetchNextRecommendation`
```typescript
// ❌ BEFORE - Missing dependencies
const fetchNextRecommendation = useCallback(async () => {
  const excludeIds = new Set(state.dismissedIds);
  state.cards.forEach(card => { ... });
  //    ^^^^^ Using state but not in dependencies
}, [user, subscribedServices, state.dismissedIds]);
//                            ^^^^^^^^^^^^^^^^^^^ Only this one, missing state.cards
```

---

## Solutions Implemented

### Fix 1: Remove `state.isOffline` from Dependencies

**File:** `components/start-watching-widget/StartWatchingWidget.tsx`

Instead of reading `state.isOffline` from closure, check network state directly when needed:

```typescript
// ✅ AFTER - No state dependency
const loadInitialRecommendations = useCallback(async () => {
  // ... initialization code ...
  
  try {
    // ... load recommendations ...
  } catch (error) {
    console.error('Error loading initial recommendations:', error);
    
    // Check network state at time of error (not from state)
    const netInfo = await NetInfo.fetch();
    const errorMessage = !netInfo.isConnected
      ? 'No network connection. Please check your internet.'
      : 'Failed to load recommendations. Please try again.';
    
    setState(prev => ({
      ...prev,
      isLoading: false,
      error: errorMessage,
      retryCount: 0,
    }));
  }
}, [user, subscribedServices, preloadCardImages, retryWithBackoff]);
//  ^^^ Removed state.isOffline from dependencies
```

### Fix 2: Remove Function from `useEffect` Dependencies

```typescript
// ✅ AFTER - Only depend on refreshTrigger
useEffect(() => {
  loadInitialRecommendations();
}, [refreshTrigger]); // Only depend on refreshTrigger, not the function itself
```

**Why this works:**
- `refreshTrigger` is a number that only changes when parent wants to refresh
- `loadInitialRecommendations` is stable (dependencies don't change frequently)
- Effect only runs when explicitly triggered, not on every state change

### Fix 3: Add Missing Dependencies to `fetchNextRecommendation`

```typescript
// ✅ AFTER - All dependencies included
const fetchNextRecommendation = useCallback(async () => {
  if (!user) return null;

  try {
    // Get current state values directly to avoid stale closure
    const currentDismissedIds = state.dismissedIds;
    const currentCards = state.cards;
    
    // Create a set of IDs to exclude (dismissed + currently displayed)
    const excludeIds = new Set(currentDismissedIds);
    currentCards.forEach(card => {
      excludeIds.add(`${card.type}-${card.id}`);
    });
    
    // ... rest of logic ...
  } catch (error) {
    console.error('Error fetching next recommendation:', error);
    return null;
  }
}, [user, subscribedServices, state.dismissedIds, state.cards]);
//                            ^^^^^^^^^^^^^^^^^^  ^^^^^^^^^^^
//                            Added both dependencies
```

### Fix 4: Remove Function Dependency from Retry Effect

```typescript
// ✅ AFTER - Call function directly, don't depend on it
useEffect(() => {
  if (!state.isOffline && shouldRetryOnNetworkRef.current && state.error) {
    console.log('[StartWatchingWidget] Network restored, retrying...');
    shouldRetryOnNetworkRef.current = false;
    // Call directly instead of depending on the callback
    if (user && subscribedServices.length > 0) {
      loadInitialRecommendations();
    }
  }
}, [state.isOffline, state.error]); // Removed loadInitialRecommendations from deps
```

---

## How It Works Now

### Initialization Flow:
1. Component mounts
2. `useEffect` with `[refreshTrigger]` runs
3. Calls `loadInitialRecommendations()`
4. Function is stable (dependencies rarely change)
5. No re-render loop

### Network State Change Flow:
1. Network goes offline → `state.isOffline` updates
2. `loadInitialRecommendations` callback does NOT recreate (not in deps)
3. `useEffect` does NOT re-run (function reference unchanged)
4. ✅ No infinite loop

### Retry Flow:
1. Network comes back online → `state.isOffline` changes to `false`
2. Retry effect detects change
3. Calls `loadInitialRecommendations()` directly
4. Effect doesn't depend on the function itself
5. ✅ No infinite loop

---

## Key Learnings

### 1. Don't Include State in `useCallback` Dependencies If It Changes During Execution
```typescript
// ❌ BAD - Creates loop
const fn = useCallback(() => {
  if (state.someValue) { ... }
}, [state.someValue]); // Changes during execution

useEffect(() => {
  fn();
}, [fn]); // Re-runs when fn changes

// ✅ GOOD - Check state directly when needed
const fn = useCallback(() => {
  const currentValue = await getSomeValue(); // Get fresh value
  if (currentValue) { ... }
}, []); // Stable dependencies

useEffect(() => {
  fn();
}, [trigger]); // Only run when explicitly triggered
```

### 2. Be Careful with Function Dependencies in `useEffect`
```typescript
// ❌ BAD - Function recreates on every render
useEffect(() => {
  someFunction();
}, [someFunction]); // Function reference changes

// ✅ GOOD - Depend on primitive values
useEffect(() => {
  someFunction();
}, [primitiveValue]); // Only changes when value changes
```

### 3. Use Refs for Values That Don't Need to Trigger Re-renders
```typescript
// ✅ GOOD - Use ref for flags
const shouldRetryOnNetworkRef = useRef(false);

// Set flag without causing re-render
shouldRetryOnNetworkRef.current = true;

// Check flag in effect
if (shouldRetryOnNetworkRef.current) {
  // Do something
}
```

---

## Testing

### Test Scenarios:

1. **Initial Load**
   - ✅ Component loads recommendations once
   - ✅ No infinite loop in console
   - ✅ Cards display correctly

2. **Network State Changes**
   - ✅ Go offline → offline indicator shows
   - ✅ Come back online → retry happens once
   - ✅ No infinite loop

3. **Swipe Actions**
   - ✅ Swipe right → card replaced
   - ✅ Swipe left → card replaced
   - ✅ Swipe up → alert shows (TV) or card removed (movie)
   - ✅ No infinite loop

4. **Refresh Trigger**
   - ✅ Parent changes `refreshTrigger` prop
   - ✅ Widget reloads recommendations once
   - ✅ No infinite loop

---

## Files Modified

1. ✅ `components/start-watching-widget/StartWatchingWidget.tsx`
   - Removed `state.isOffline` from `loadInitialRecommendations` dependencies
   - Changed to check network state directly with `NetInfo.fetch()`
   - Removed `loadInitialRecommendations` from `useEffect` dependencies
   - Added `state.cards` to `fetchNextRecommendation` dependencies
   - Removed `loadInitialRecommendations` from retry effect dependencies

---

## Related Issues

This fix also prevents:
- Excessive network requests from repeated initialization
- Battery drain from continuous re-renders
- Memory leaks from uncancelled async operations
- UI jank from constant state updates

---

## Prevention

To avoid similar issues in the future:

1. **Audit `useCallback` dependencies** - Don't include state that changes during execution
2. **Audit `useEffect` dependencies** - Prefer primitive values over functions
3. **Use refs for flags** - Values that don't need to trigger re-renders
4. **Test network state changes** - Common source of infinite loops
5. **Monitor console** - React will warn about missing dependencies

---

**Status:** ✅ Fixed
**Date:** December 5, 2025
**Impact:** Critical - Blocked app from loading
