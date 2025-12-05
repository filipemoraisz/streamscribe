# Continue Watching Debug Guide

## Debug Logging Added

I've added comprehensive debug logging to help you track down issues with Continue Watching items.

## What You'll See in Console

### 1. When Continue Watching Loads (Home Screen)
```
[HomeScreen] 🔄 Fetching Continue Watching...
[HomeScreen] ✅ Continue Watching loaded: 2 items [
  { title: "Breaking Bad", nextEp: "S2E5", progress: "45%" },
  { title: "The Office", nextEp: "S3E10", progress: "67%" }
]
```

### 2. For Each Show Being Processed (Service)
```
[ContinueWatching] 🔍 Processing show 1396: {
  show_id: 1396,
  current_season: 2,
  current_episode: 4,
  total_watched: 15,
  status: "watching",
  last_watched: "2024-01-15T10:30:00Z"
}

[ContinueWatching] 📺 Show: "Breaking Bad" - Next episode: {
  season: 2,
  episode: 5
}

[ContinueWatching] ✅ Added to Continue Watching: {
  title: "Breaking Bad",
  nextEpisode: "S2E5",
  progress: "45%",
  watched: "15/33"
}
```

### 3. For Each Item Being Rendered (Component)
```
[ContinueWatchingSection] 🎬 Rendering item: {
  id: 1396,
  type: "tv",
  title: "Breaking Bad",
  nextEpisode: "S2E5",
  progress: "45%",
  lastWatched: "2024-01-15T10:30:00Z"
}
```

## What to Look For

### ❌ Invalid Episode Issue
If you see this pattern, you have an invalid episode:
```
[ContinueWatching] 🔍 Processing show 12345: {
  current_season: 1,
  current_episode: 99,  // ⚠️ Episode 99 doesn't exist!
  ...
}

[ContinueWatching] ⏭️ No next episode for "Show Name" - likely completed
```

**Solution**: The episode number is invalid. Use the cleanup SQL scripts to delete it.

### ⚠️ Missing Show Details
```
[ContinueWatching] ⚠️ No show details found for 12345
```

**Possible causes**:
- Show was removed from TMDB
- Network issue
- Invalid show ID

### ✅ Normal Operation
```
[ContinueWatching] ✅ Added to Continue Watching: { ... }
```

This means the item was successfully processed and will appear in the UI.

## How to Use This Debug Info

1. **Open your app's console/logs** (React Native Debugger, Metro bundler, or device logs)

2. **Navigate to the home screen** to trigger Continue Watching load

3. **Look for the debug logs** with the emoji prefixes:
   - 🔄 = Loading started
   - 🔍 = Processing show
   - 📺 = Show details fetched
   - ✅ = Success
   - ⚠️ = Warning
   - ❌ = Error
   - ⏭️ = Skipped (no next episode)
   - 🎬 = Rendering item

4. **Identify the problem**:
   - If a show has `current_episode: 99` or other invalid number → Delete that record
   - If a show has no next episode but should → Check episode_progress table
   - If items aren't rendering → Check the rendering logs

## Quick Fixes

### Invalid Episode Found
```sql
-- Use the show_id from the logs
DELETE FROM episode_progress
WHERE user_id = 'your-user-id'
  AND show_id = 12345
  AND episode_number > 50;  -- Delete suspiciously high episode numbers
```

### Clear Cache and Reload
```typescript
// In your app, run once:
import AsyncStorage from '@react-native-async-storage/async-storage';

const keys = await AsyncStorage.getAllKeys();
const progressKeys = keys.filter(k => k.includes('_progress_'));
await AsyncStorage.multiRemove(progressKeys);
```

## Removing Debug Logs Later

When you're done debugging, you can remove or comment out the console.log statements in:
- `services/continueWatching.ts`
- `components/ContinueWatchingSection.tsx`
- `app/(tabs)/index.tsx`

Or keep them for future debugging!
