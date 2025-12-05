# Local vs Database Sync Issue

## The Problem

You're seeing show ID `67070` in Continue Watching, but when you query the database:
```sql
SELECT * FROM episode_progress WHERE show_id = 67070;
```
It returns **nothing**. This is because your app uses **local-first architecture**.

## How Your App Works

### 1. **Local Storage (AsyncStorage)** - Primary Source
- Episodes are marked as watched and stored in AsyncStorage FIRST
- This happens immediately (optimistic update)
- Key format: `streamscribe_episodes_progress_{user_id}`

### 2. **Offline Queue** - Pending Sync
- If offline or sync fails, actions are queued
- Key: `streamscribe_offline_queue`
- These will sync when connection is restored

### 3. **Supabase Database** - Secondary/Backup
- Data syncs to database when online
- Used for cross-device sync and backup
- May be out of sync with local data

## Why Database is Empty

There are several possible reasons:

### Reason 1: **Offline Queue Not Synced**
The episode was marked as watched, but hasn't synced to Supabase yet.

**Check the queue:**
```typescript
// In your app console or add this temporarily
import AsyncStorage from '@react-native-async-storage/async-storage';

const queue = await AsyncStorage.getItem('streamscribe_offline_queue');
console.log('Offline queue:', JSON.parse(queue || '[]'));
```

### Reason 2: **Sync Failed Silently**
The sync attempted but failed (network error, validation error, etc.)

**Check your app logs for:**
```
[Progress] Error syncing to Supabase:
[Progress] Sync error:
```

### Reason 3: **RLS (Row Level Security) Blocking**
Supabase RLS policies might be preventing the insert.

**Test RLS:**
```sql
-- Check if you can insert manually
INSERT INTO episode_progress (
  user_id,
  show_id,
  season_number,
  episode_number,
  watched,
  watched_date
) VALUES (
  'your-user-id-here',
  67070,
  1,
  1,
  true,
  NOW()
);
```

If this fails, your RLS policies are blocking inserts.

### Reason 4: **Wrong User ID**
The local data is using a different user_id than you're querying.

**Check your user ID:**
```sql
-- See all users
SELECT id, email FROM auth.users;

-- Check ALL episode progress (might be under different user)
SELECT user_id, show_id, season_number, episode_number 
FROM episode_progress 
WHERE show_id = 67070;
```

## How to Fix

### Solution 1: Force Sync Now

Add this to your app temporarily to force a sync:

```typescript
import { progressService } from '@/services/progress';

// Force sync pending actions
await progressService.syncPendingActions();
console.log('Sync complete!');
```

### Solution 2: Check Local Data

See what's actually stored locally:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get your user ID first
const { data: { user } } = await supabase.auth.getUser();
console.log('User ID:', user?.id);

// Check local episode progress
const key = `streamscribe_episodes_progress_${user?.id}`;
const localData = await AsyncStorage.getItem(key);
const episodes = JSON.parse(localData || '[]');

// Filter for show 67070
const show67070Episodes = episodes.filter(ep => ep.show_id === 67070);
console.log('Local episodes for show 67070:', show67070Episodes);

// Check offline queue
const queueData = await AsyncStorage.getItem('streamscribe_offline_queue');
const queue = JSON.parse(queueData || '[]');
console.log('Offline queue:', queue);
```

### Solution 3: Clear Local Cache and Start Fresh

If data is corrupted:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Clear all progress data
const keys = await AsyncStorage.getAllKeys();
const progressKeys = keys.filter(k => 
  k.includes('_episodes_progress_') || 
  k.includes('_shows_progress_') ||
  k === 'streamscribe_offline_queue'
);
await AsyncStorage.multiRemove(progressKeys);
console.log('Cleared:', progressKeys);

// Restart app and mark episodes again
```

## Debugging Steps

### Step 1: Check What's in Local Storage

Run this in your app:
```typescript
const { data: { user } } = await supabase.auth.getUser();
const key = `streamscribe_episodes_progress_${user?.id}`;
const data = await AsyncStorage.getItem(key);
console.log('LOCAL DATA:', JSON.parse(data || '[]').filter(e => e.show_id === 67070));
```

### Step 2: Check Offline Queue

```typescript
const queue = await AsyncStorage.getItem('streamscribe_offline_queue');
console.log('QUEUE:', JSON.parse(queue || '[]'));
```

### Step 3: Check Database with Correct User ID

```sql
-- First get your user ID from the app logs or:
SELECT id, email FROM auth.users;

-- Then query with that specific user_id
SELECT * FROM episode_progress 
WHERE user_id = 'paste-user-id-here' 
  AND show_id = 67070;
```

### Step 4: Try Manual Sync

```typescript
import { progressService } from '@/services/progress';
await progressService.syncPendingActions();
```

## Prevention

The new validation I added will help prevent invalid episodes from being saved locally in the first place. But you still need to:

1. **Ensure network connectivity** when marking episodes
2. **Check app logs** for sync errors
3. **Verify RLS policies** allow inserts
4. **Use correct user ID** in queries

## Quick Diagnostic Script

Add this to your app temporarily:

```typescript
async function diagnoseShow67070() {
  const { data: { user } } = await supabase.auth.getUser();
  
  console.log('=== DIAGNOSTIC FOR SHOW 67070 ===');
  console.log('User ID:', user?.id);
  
  // Check local storage
  const key = `streamscribe_episodes_progress_${user?.id}`;
  const localData = await AsyncStorage.getItem(key);
  const episodes = JSON.parse(localData || '[]');
  const show67070 = episodes.filter(e => e.show_id === 67070);
  console.log('Local episodes:', show67070);
  
  // Check queue
  const queueData = await AsyncStorage.getItem('streamscribe_offline_queue');
  const queue = JSON.parse(queueData || '[]');
  const show67070Queue = queue.filter(q => q.payload?.showId === 67070);
  console.log('Queued actions:', show67070Queue);
  
  // Check database
  const { data: dbData } = await supabase
    .from('episode_progress')
    .select('*')
    .eq('user_id', user?.id)
    .eq('show_id', 67070);
  console.log('Database episodes:', dbData);
  
  console.log('=== END DIAGNOSTIC ===');
}

// Run it
diagnoseShow67070();
```

This will show you exactly where the data is and where it's missing!
