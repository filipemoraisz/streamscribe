# Streak Tracking Integration Documentation

## Overview
This document describes how streak tracking has been integrated into the episode watching flow, including online and offline scenarios.

## Architecture

### Services Involved
1. **userActivityService** - Manages user activity stats and streak tracking
2. **progressService** - Manages episode progress and triggers streak updates
3. **achievementChecker** - Checks for streak-related achievements

### Data Flow

```
User watches episode
    ↓
progressService.markEpisodeWatched()
    ↓
├─→ Update local cache (optimistic)
├─→ Sync to Supabase (if online)
├─→ Update streak tracking (if online)
│   └─→ userActivityService.trackEpisodeWatched()
│       ├─→ updateStreak() - Call DB function
│       └─→ Update episode count & hours
└─→ Check achievements
```

## Implementation Details

### 1. Single Episode Watch Flow

**File:** `services/progress.ts` - `markEpisodeWatched()`

**Online Scenario:**
1. Update local AsyncStorage cache (optimistic)
2. Sync episode to Supabase database
3. Call `userActivityService.trackEpisodeWatched(userId, runtime)`
   - This internally calls `updateStreak()` which executes the `update_user_streak` DB function
   - Updates `total_episodes_watched` and `total_hours_watched`
   - Clears user stats cache
4. Check achievements (episode and streak achievements)

**Offline Scenario:**
1. Update local AsyncStorage cache (optimistic)
2. Add episode to offline queue
3. Streak will be updated when connection is restored and queue is synced

### 2. Batch Episode Watch Flow

**File:** `services/progress.ts` - `markEpisodesUpTo()`

**Online Scenario:**
1. Update local AsyncStorage cache (optimistic)
2. Batch sync all episodes to Supabase
3. Call `userActivityService.updateStreak(userId)` once after batch
4. Check achievements

**Offline Scenario:**
1. Update local AsyncStorage cache (optimistic)
2. Add all episodes to offline queue
3. Streak will be updated when connection is restored

### 3. Offline Queue Sync

**File:** `services/progress.ts` - `syncPendingActions()`

When the app comes back online:
1. Process all queued episode watch actions
2. Sync to Supabase
3. Count how many episodes were synced
4. Call `userActivityService.updateStreak(userId)` once after all syncs
5. Refresh local cache from server

## Database Functions

### update_user_streak(user_id)

**Location:** `add_streak_and_impact_stats.sql`

**Behavior:**
- Checks `last_streak_date` to determine streak status
- If watched today: No change
- If watched yesterday: Increment streak
- If missed a day: Reset streak to 1
- Updates `longest_streak` if current exceeds it
- Returns current and longest streak values

**Called by:**
- `userActivityService.updateStreak()`
- `userActivityService.trackEpisodeWatched()` (internally)

## Helper Functions Added

### userActivityService

#### `updateStreak(userId)`
Directly calls the database function to update streak.

**Returns:** `{ currentStreak, longestStreak }`

#### `trackEpisodeWatched(userId, runtime)`
Comprehensive tracking when an episode is watched:
- Updates streak (calls `updateStreak()`)
- Increments episode count
- Adds to total hours watched
- Clears stats cache

**Parameters:**
- `userId`: User UUID
- `runtime`: Episode runtime in minutes (default: 45)

#### `getAggregatedStats(userId)`
Fetches fresh stats from database, bypassing cache.

**Returns:** Object with all key stats

#### `getStreakStatus(userId)`
Gets current streak status including whether user watched today.

**Returns:**
```typescript
{
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
  isActiveToday: boolean;
}
```

#### `updateActivityMetrics(userId, updates)`
Updates activity tracking metrics like hours watched, savings, etc.

#### `incrementEpisodeCount(userId, runtime)`
Increments episode count and hours watched (alternative to `trackEpisodeWatched`).

## Offline Handling

### Strategy
1. **Optimistic Updates:** Local cache is updated immediately
2. **Queue System:** Actions are queued when offline
3. **Batch Sync:** Queue is processed when connection is restored
4. **Single Streak Update:** Streak is updated once after all queued episodes are synced

### Benefits
- User sees immediate feedback
- No data loss when offline
- Efficient batch processing
- Accurate streak calculation after sync

## Error Handling

### Streak Update Failures
- Logged but don't fail the main operation
- User can still watch episodes
- Stats will be corrected on next successful update

### Offline Queue Failures
- Failed actions remain in queue
- Retry on next sync attempt
- User is not blocked from watching

### Database Function Errors
- Returns `{ currentStreak: 0, longestStreak: 0 }` as fallback
- Logged for debugging
- Cache is cleared to force refresh on next load

## Testing Scenarios

### 1. Watch Episode Online
✅ Episode marked as watched
✅ Streak incremented
✅ Hours tracked
✅ Achievements checked

### 2. Watch Episode Offline
✅ Episode marked as watched locally
✅ Queued for sync
✅ Streak updated when online

### 3. Watch Multiple Episodes (Batch)
✅ All episodes marked as watched
✅ Streak updated once
✅ Efficient database operations

### 4. Daily Streak Continuation
✅ Watch episode today after watching yesterday
✅ Streak increments by 1
✅ Longest streak updated if exceeded

### 5. Streak Break
✅ Miss a day
✅ Streak resets to 1 on next watch
✅ Longest streak preserved

### 6. First Time User
✅ Activity tracking initialized
✅ Streak starts at 1
✅ All metrics tracked

## Performance Considerations

### Caching
- User stats cached for 5 minutes
- Background refresh on app focus
- Cache cleared after streak updates

### Database Queries
- Parallel queries for stats aggregation
- Batch operations for multiple episodes
- Indexed columns for fast lookups

### Network Efficiency
- Single streak update per batch operation
- Offline queue prevents duplicate requests
- Optimistic updates reduce perceived latency

## Migration Requirements

### Database
1. Run `add_streak_and_impact_stats.sql` migration
2. Verify columns added to `user_activity_tracking`
3. Test `update_user_streak()` function

### Code
✅ Already integrated in:
- `services/userActivity.ts`
- `services/progress.ts`

### No Breaking Changes
- Existing functionality preserved
- Graceful fallbacks for errors
- Backward compatible

## Monitoring & Debugging

### Log Messages
- `[Progress] Updating streak and activity tracking for user: {userId}`
- `[Progress] ✅ Streak and activity tracking updated`
- `[Progress] Offline - streak will be updated when connection is restored`
- `[Progress] Synced {count} episodes, updating streak`

### Key Metrics to Monitor
- Streak update success rate
- Offline queue size
- Sync completion time
- Achievement unlock rate

## Future Enhancements

### Potential Improvements
1. **Streak Reminders:** Notify users before streak expires
2. **Streak Recovery:** Allow one "freeze" day per week
3. **Social Features:** Share streak milestones
4. **Analytics:** Track streak patterns and engagement
5. **Gamification:** Bonus points for long streaks

### Optimization Opportunities
1. Batch streak updates for multiple users (admin tool)
2. Scheduled job to reset stale streaks (use `check_and_reset_stale_streaks()`)
3. Real-time streak updates via Supabase subscriptions
4. Predictive caching based on user patterns

## Support & Troubleshooting

### Common Issues

**Issue:** Streak not updating
**Solution:** Check network connection, verify database function exists, check logs

**Issue:** Streak reset unexpectedly
**Solution:** Verify `last_streak_date` in database, check timezone handling

**Issue:** Offline queue not syncing
**Solution:** Check network state, verify queue contents in AsyncStorage

### Debug Commands

```typescript
// Check streak status
const status = await userActivityService.getStreakStatus(userId);
console.log('Streak Status:', status);

// Force streak update
const result = await userActivityService.updateStreak(userId);
console.log('Streak Updated:', result);

// Get fresh stats
const stats = await userActivityService.getAggregatedStats(userId);
console.log('User Stats:', stats);

// Clear cache
await userActivityService.clearUserStatsCache(userId);
```

## Conclusion

The streak tracking integration is complete and production-ready. It handles both online and offline scenarios gracefully, provides accurate tracking, and integrates seamlessly with the existing episode watching flow.

Key achievements:
✅ Automatic streak updates when episodes are watched
✅ Offline support with queue system
✅ Efficient batch operations
✅ Comprehensive error handling
✅ Performance optimized with caching
✅ Achievement integration
✅ Detailed logging for debugging
