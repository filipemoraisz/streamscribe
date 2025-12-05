# Streak Tracking Debug Guide

## Issue
Streak tracking was not being initiated when marking episodes as watched.

## Root Cause
The streak tracking code was placed outside the successful sync try-catch block, so it wasn't being executed after the episode was synced to Supabase.

## Fix Applied
Moved the streak tracking code inside the successful sync block so it executes immediately after the episode is synced.

## Changes Made

### 1. Fixed Code Structure in `services/progress.ts`
**Before:**
```typescript
try {
    // Sync to Supabase
    const { error } = await supabase.from('episode_progress').upsert(...);
    if (error) {
        // Handle error
    } else {
        console.log('✅ Episode synced');
    }
} catch (syncError) {
    // Handle error
}

// Streak tracking was HERE (outside the try-catch)
console.log('Updating streak...');
await userActivityService.trackEpisodeWatched(userId, runtime);
```

**After:**
```typescript
try {
    // Sync to Supabase
    const { error } = await supabase.from('episode_progress').upsert(...);
    if (error) {
        // Handle error
    } else {
        console.log('✅ Episode synced');
        
        // Streak tracking is NOW HERE (inside successful sync block)
        console.log('Updating streak...');
        await userActivityService.trackEpisodeWatched(userId, runtime);
    }
} catch (syncError) {
    // Handle error
}
```

### 2. Added Detailed Logging
Added comprehensive logging to both services to help debug:

**In `services/userActivity.ts`:**
- `[UserActivity] trackEpisodeWatched called for user: {userId}, runtime: {runtime}`
- `[UserActivity] Calling updateStreak...`
- `[UserActivity] Streak updated - Current: X, Longest: Y`
- `[UserActivity] Calling update_user_streak RPC for user: {userId}`
- `[UserActivity] RPC response: {data}`
- `[UserActivity] Error details: {error}` (if error occurs)

**In `services/progress.ts`:**
- `[Progress] Updating streak and activity tracking for user: {userId}`
- `[Progress] ✅ Streak and activity tracking updated`

## Testing Steps

### 1. Reload the App
Since the code was updated, you need to reload:
- **iOS Simulator:** Press `Cmd + R`
- **Android Emulator:** Press `R` twice
- **Physical Device:** Shake device and select "Reload"

### 2. Watch an Episode
Mark an episode as watched and check the logs.

### 3. Expected Log Output
You should now see:
```
LOG  [Progress] markEpisodeWatched called for showId: X, S1E1
LOG  [Progress] Syncing episode to Supabase for achievement checking
LOG  [Progress] ✅ Episode synced to Supabase successfully
LOG  [Progress] Updating streak and activity tracking for user: {userId}
LOG  [UserActivity] trackEpisodeWatched called for user: {userId}, runtime: 45
LOG  [UserActivity] Calling updateStreak...
LOG  [UserActivity] Calling update_user_streak RPC for user: {userId}
LOG  [UserActivity] RPC response: [...]
LOG  [UserActivity] Streak updated - Current: 1, Longest: 1
LOG  [UserActivity] Updating activity tracking - Episodes: 1, Hours: 0.75
LOG  [UserActivity] ✅ Activity tracking updated successfully
LOG  [UserActivity] Cache cleared
LOG  [Progress] ✅ Streak and activity tracking updated
LOG  [Progress] Checking achievements for user: {userId}
```

## Verification Steps

### 1. Check Database
Run this query in Supabase SQL Editor:
```sql
SELECT 
    user_id,
    current_streak,
    longest_streak,
    last_streak_date,
    total_episodes_watched,
    total_hours_watched
FROM user_activity_tracking
WHERE user_id = 'your-user-id-here';
```

You should see:
- `current_streak`: 1 (or higher if you watched multiple days)
- `longest_streak`: 1 (or higher)
- `last_streak_date`: Today's date
- `total_episodes_watched`: Number of episodes watched
- `total_hours_watched`: Total hours (episodes * runtime / 60)

### 2. Check Profile Screen
Navigate to the profile screen and verify:
- Current streak displays correctly
- Longest streak displays correctly
- Total episodes count is accurate
- Total hours watched is accurate

## Common Issues & Solutions

### Issue: Still no streak logs after reload
**Solution:** 
1. Make sure you fully reloaded the app (not just hot reload)
2. Check that the migration was run successfully
3. Verify the `update_user_streak` function exists in Supabase

**Verify function exists:**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'update_user_streak';
```

### Issue: "permission denied for table users" error
**Solution:** The function needs SECURITY DEFINER to bypass RLS:
1. Open Supabase SQL Editor
2. Copy contents of `fix_streak_function_permissions.sql`
3. Execute the fix migration
4. Reload your app and try again

**What this does:** Sets the function to run with elevated permissions so it can access the `user_activity_tracking` table regardless of RLS policies.

### Issue: RPC error "function does not exist"
**Solution:** Run the migration again:
1. Open Supabase SQL Editor
2. Copy contents of `add_streak_and_impact_stats.sql`
3. Execute the migration

### Issue: RPC error "column does not exist"
**Solution:** The columns weren't added. Run this:
```sql
ALTER TABLE user_activity_tracking 
ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_streak_date DATE,
ADD COLUMN IF NOT EXISTS optimized_hours DECIMAL(10, 2) DEFAULT 0.00;
```

### Issue: Streak is 0 even after watching
**Solution:** Check if user has a record in `user_activity_tracking`:
```sql
SELECT * FROM user_activity_tracking WHERE user_id = 'your-user-id-here';
```

If no record exists, initialize it:
```sql
INSERT INTO user_activity_tracking (
    user_id, 
    current_streak, 
    longest_streak,
    total_episodes_watched,
    total_hours_watched
) VALUES (
    'your-user-id-here',
    0,
    0,
    0,
    0
);
```

### Issue: Logs show error "No activity tracking record found"
**Solution:** The user needs to be initialized. The app should do this automatically, but you can manually trigger it:
```typescript
await userActivityService.initializeUserActivity(userId);
```

## Debug Commands

### Check Current Streak Status
```typescript
const status = await userActivityService.getStreakStatus(userId);
console.log('Streak Status:', status);
```

### Force Streak Update
```typescript
const result = await userActivityService.updateStreak(userId);
console.log('Streak Updated:', result);
```

### Get Fresh Stats
```typescript
const stats = await userActivityService.getAggregatedStats(userId);
console.log('User Stats:', stats);
```

### Clear Cache
```typescript
await userActivityService.clearUserStatsCache(userId);
console.log('Cache cleared');
```

## Next Steps

1. **Reload the app** to get the updated code
2. **Watch an episode** and check the logs
3. **Verify in database** that streak was updated
4. **Check profile screen** to see the streak displayed

If you still see issues after reloading, share the complete log output and I'll help debug further!
