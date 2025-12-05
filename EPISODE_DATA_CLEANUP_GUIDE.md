# Episode Data Cleanup Guide

## Problem
You have an invalid episode record in your database (an episode that doesn't exist in TMDB), which is breaking your "next episode" logic.

## Quick Fix Steps

### Step 1: Find the Bad Data

Run this query in your Supabase SQL editor:

```sql
-- See all your episode progress
SELECT 
  ep.id,
  ep.user_id,
  ep.show_id,
  ep.season_number,
  ep.episode_number,
  ep.watched,
  ep.watched_date
FROM episode_progress ep
ORDER BY ep.show_id, ep.season_number, ep.episode_number;
```

Look for:
- Episodes with unusually high numbers (e.g., S1E99)
- Season 0 episodes (specials can cause issues)
- Episodes that seem wrong for the show

### Step 2: Delete the Invalid Record

Once you identify the bad record, delete it:

```sql
-- Replace with your actual values
DELETE FROM episode_progress
WHERE user_id = 'your-user-id-here'
  AND show_id = 12345
  AND season_number = 1
  AND episode_number = 99;
```

### Step 3: Clear Local Cache

After deleting from the database, you need to clear the local cache in your app:

1. **Option A: Clear app data** (easiest)
   - On iOS: Delete and reinstall the app
   - On Android: Go to Settings > Apps > Your App > Clear Data

2. **Option B: Add a manual cache clear** (if you want to keep other data)
   - Add this to your app temporarily:
   ```typescript
   // In your app, run this once
   import AsyncStorage from '@react-native-async-storage/async-storage';
   
   async function clearProgressCache() {
     const keys = await AsyncStorage.getAllKeys();
     const progressKeys = keys.filter(k => 
       k.includes('_episodes_progress_') || 
       k.includes('_shows_progress_')
     );
     await AsyncStorage.multiRemove(progressKeys);
     console.log('Progress cache cleared!');
   }
   
   // Call this function once
   clearProgressCache();
   ```

### Step 4: Verify Fix

After cleanup:

1. Restart your app
2. Navigate to the show that was causing issues
3. The "next episode" should now work correctly

## Prevention

The code has been updated to validate episodes before saving them. From now on:

✅ Episodes are validated using **cached show data** (fast, no API calls)  
✅ Validation checks if the season exists and if the episode number is within range  
✅ Invalid episodes will throw an error instead of being saved  
✅ Users will see a clear error message if they try to mark a non-existent episode  
✅ Works offline - if validation can't be performed, it allows the operation (graceful degradation)  

## Common Causes

This usually happens when:
1. **Manual testing** - Marking episodes that don't exist
2. **API changes** - TMDB data changes and episodes get renumbered
3. **Specials** - Season 0 episodes can have weird numbering
4. **Data migration** - Old data from before validation was added

## If You Need to Find Your User ID

Run this in Supabase SQL editor:

```sql
SELECT id, email FROM auth.users;
```

Or check your app's auth context/console logs.
