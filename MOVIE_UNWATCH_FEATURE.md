# Movie Unwatch Feature

## Overview
Added the ability to "unwatch" movies, allowing users to change their mind about marking a movie as watched.

## Changes Made

### 1. Movie Details Screen (`app/details/[type]/[id].tsx`)
Updated `handleMarkMovieWatched` function to handle unwatching:

**When clicking "Watched" button on a watched movie:**
- ✅ Marks movie as unwatched (status → `plan_to_watch`)
- ✅ Resets rewatch count to 0
- ✅ Keeps movie in watchlist (watchlist icon remains ticked)
- ✅ User can then remove from watchlist by clicking the watchlist icon

### 2. Storage Service (`services/storage.ts`)
Added new `unwatchMovie` method:

```typescript
async unwatchMovie(id: number): Promise<void>
```

**What it does:**
- Updates local state (watched = false, rewatch_count = 0)
- Updates database status to `plan_to_watch`
- Resets rewatch_count to 0 in database
- Handles offline scenarios with queue system

## User Flow

### Before (Old Behavior)
1. Mark movie as watched → Movie shows "Watched" label
2. Click "Watched" again → Nothing happens (or unclear behavior)
3. No way to unwatch a movie

### After (New Behavior)
1. **Mark movie as watched** → Movie shows "Watched" label with rewatch counter
2. **Click "Watched" again** → Movie becomes unwatched
   - Status changes to `plan_to_watch`
   - Rewatch count resets to 0
   - Watchlist icon shows as ticked (movie stays in watchlist)
3. **Click watchlist icon** → Removes movie from watchlist completely

## Database Updates

When unwatching a movie, the following fields are updated in the `watchlists` table:
- `status`: `'completed'` → `'plan_to_watch'`
- `rewatch_count`: `<any value>` → `0`

## Benefits

1. **Flexibility** - Users can change their mind about watched status
2. **Data Integrity** - Rewatch count is properly reset when unwatching
3. **Clear UX** - Movie stays in watchlist after unwatching, giving users control
4. **Consistency** - Matches the TV show behavior where unwatching episodes returns status to `plan_to_watch`

## Testing

To test the feature:

1. **Watch a movie**
   - Go to movie details
   - Click "Mark as Watched"
   - ✅ Should show "Watched" label

2. **Rewatch a few times**
   - Click the "+" button next to rewatch counter
   - ✅ Counter should increment

3. **Unwatch the movie**
   - Click the "Watched" label/button
   - ✅ Should return to showing "Mark as Watched" button
   - ✅ Watchlist icon should be ticked
   - ✅ Rewatch count should be 0

4. **Remove from watchlist**
   - Click the watchlist icon
   - ✅ Movie should be removed from watchlist
   - ✅ Should show "Add to Watchlist" button

## Related Files
- `app/details/[type]/[id].tsx` - Movie details UI
- `services/storage.ts` - Storage service with unwatch logic
- `services/progress.ts` - Already had similar logic for TV shows
