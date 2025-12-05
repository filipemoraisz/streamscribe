# Unmark Episode Stats Update Fix

## The Problem

When unmarking an episode (marking it as unwatched), the episode count in "Your Journey" widget was NOT decreasing. The stats only updated when marking episodes as watched, not when unmarking them.

## Root Cause

The `markEpisodeUnwatched()` function in `services/progress.ts` was missing a critical line:

```typescript
this.notifyProgressUpdate();
```

Without this notification, the progress update subscription in the home screen didn't know to refresh the stats.

## The Fix

Added `notifyProgressUpdate()` call at the end of `markEpisodeUnwatched()`:

### Before:
```typescript
async markEpisodeUnwatched(showId, seasonNumber, episodeNumber) {
  // 1. Remove from local storage
  // 2. Update show progress
  // 3. Queue for sync
  
  // ❌ Missing: No notification to listeners!
}
```

### After:
```typescript
async markEpisodeUnwatched(showId, seasonNumber, episodeNumber) {
  // 1. Remove from local storage
  // 2. Update show progress
  // 3. Queue for sync
  
  // ✅ Notify listeners that progress has been updated
  this.notifyProgressUpdate();
}
```

## How It Works Now

When you unmark an episode:

1. **Local Update**: Episode removed from AsyncStorage
2. **Show Progress Update**: Show's progress recalculated
3. **Notification**: `notifyProgressUpdate()` called
4. **Subscription Triggered**: Home screen subscription fires
5. **Stats Refresh**: `fetchUserStats()` called
6. **UI Update**: "Your Journey" episode count decreases

## Where Episodes Can Be Unmarked

Episodes can be unmarked from:
- ✅ Episode detail screen (`app/episode/[showId]/[seasonNumber]/[episodeNumber].tsx`)
- ✅ Season screen (`app/season/[showId]/[seasonNumber].tsx`)

Both now trigger the stats update automatically via the subscription.

## Testing

1. Mark an episode as watched
2. Verify "Your Journey" episode count increases
3. Unmark the same episode
4. Verify "Your Journey" episode count decreases
5. Verify Continue Watching updates correctly

## Result

✅ Marking episodes as watched increases episode count  
✅ Unmarking episodes decreases episode count  
✅ Stats update in real-time for both actions  
✅ No manual refresh needed  
✅ Consistent behavior across all screens
