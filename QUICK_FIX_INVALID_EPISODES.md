# Quick Fix: Invalid Episodes

## 🚨 Problem
Your "next episode" is stuck because you have an invalid episode in the database.

## ⚡ Quick Fix (5 minutes)

### Step 1: Find Bad Data (30 seconds)
Open Supabase SQL Editor and run:

```sql
SELECT * FROM episode_progress 
WHERE episode_number > 50 OR season_number > 20 OR season_number = 0
ORDER BY episode_number DESC;
```

### Step 2: Delete It (30 seconds)
Copy the `id` from the result above and run:

```sql
DELETE FROM episode_progress WHERE id = 'paste-id-here';
```

### Step 3: Clear Cache (1 minute)
Delete and reinstall your app, OR add this code temporarily:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

async function clearProgressCache() {
  const keys = await AsyncStorage.getAllKeys();
  const progressKeys = keys.filter(k => 
    k.includes('_episodes_progress_') || 
    k.includes('_shows_progress_')
  );
  await AsyncStorage.multiRemove(progressKeys);
  console.log('✅ Cache cleared!');
}

clearProgressCache(); // Run once
```

### Step 4: Test (1 minute)
1. Restart app
2. Navigate to the show
3. Mark an episode as watched
4. ✅ Should work now!

## 🛡️ Prevention (Already Done!)

The code now validates episodes before saving:
- ✅ Uses cached show data (fast!)
- ✅ Checks season exists
- ✅ Checks episode is in valid range
- ✅ Shows clear error messages

## 📚 More Details

See `EPISODE_VALIDATION_FIX_SUMMARY.md` for complete documentation.
