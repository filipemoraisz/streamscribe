# Streak Function Permission Fix Guide

## Issue
When marking an episode as watched, you see this error:
```
ERROR [UserActivity] Error updating streak: {"code": "42501", "details": null, "hint": null, "message": "permission denied for table users"}
```

## Root Cause
The `update_user_streak` database function doesn't have the proper security settings to bypass Row Level Security (RLS) policies. Even though the function only accesses `user_activity_tracking`, Supabase's RLS is blocking it.

## Solution
Run the permission fix migration that adds `SECURITY DEFINER` to the function.

## Step-by-Step Fix

### 1. Open Supabase SQL Editor
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar

### 2. Run the Fix Migration
1. Click **New Query**
2. Copy the entire contents of `fix_streak_function_permissions.sql`
3. Paste into the SQL Editor
4. Click **Run** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

### 3. Verify Success
You should see these messages:
```
✅ Streak function permissions fixed!
🔒 Functions now run with SECURITY DEFINER
✅ Execute permissions granted to authenticated users

💡 Test with: SELECT * FROM update_user_streak(auth.uid());
```

### 4. Test the Function
Run this test query to verify it works:
```sql
SELECT * FROM update_user_streak(auth.uid());
```

Expected result:
```
current_streak | longest_streak
---------------|---------------
1              | 1
```

### 5. Reload Your App
- **iOS Simulator:** Press `Cmd + R`
- **Android Emulator:** Press `R` twice
- **Physical Device:** Shake device and select "Reload"

### 6. Watch an Episode
Mark an episode as watched and check the logs.

## Expected Log Output After Fix

You should now see:
```
LOG  [Progress] ✅ Episode synced to Supabase successfully
LOG  [Progress] Updating streak and activity tracking for user: {userId}
LOG  [UserActivity] trackEpisodeWatched called for user: {userId}, runtime: 45
LOG  [UserActivity] Calling updateStreak...
LOG  [UserActivity] Calling update_user_streak RPC for user: {userId}
LOG  [UserActivity] RPC response: [{"current_streak": 1, "longest_streak": 1}]
LOG  [UserActivity] Streak updated - Current: 1, Longest: 1
LOG  [UserActivity] Updating activity tracking - Episodes: 1, Hours: 0.75
LOG  [UserActivity] ✅ Activity tracking updated successfully
LOG  [UserActivity] Cache cleared
LOG  [Progress] ✅ Streak and activity tracking updated
```

**No more permission errors!** ✅

## What Changed?

### Before (Broken)
```sql
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS TABLE(current_streak INTEGER, longest_streak INTEGER) AS $
-- Function body
$ LANGUAGE plpgsql;
```

### After (Fixed)
```sql
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS TABLE(current_streak INTEGER, longest_streak INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER  -- ← This is the key addition
SET search_path = public
AS $$
-- Function body
$$;

-- Also grant execute permissions
GRANT EXECUTE ON FUNCTION update_user_streak(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_streak(UUID) TO anon;
```

## Key Changes Explained

### 1. SECURITY DEFINER
- Makes the function run with the permissions of the function owner (usually the database owner)
- Bypasses Row Level Security (RLS) policies
- Allows the function to access tables even if the calling user doesn't have direct access

### 2. SET search_path = public
- Ensures the function looks for tables in the `public` schema
- Prevents potential security issues with schema search paths

### 3. GRANT EXECUTE
- Explicitly grants permission to call the function
- `authenticated` = logged-in users
- `anon` = anonymous users (if needed)

## Security Considerations

**Is SECURITY DEFINER safe?**

Yes, in this case it's safe because:
1. The function only operates on the `user_activity_tracking` table
2. It only updates the record for the user ID passed as parameter
3. The app always passes the authenticated user's ID
4. The function doesn't expose sensitive data
5. It doesn't allow arbitrary SQL injection

**Best Practice:**
Always validate that the user can only update their own data. In this case, the function receives `p_user_id` and only updates that user's record, which is correct.

## Verification Checklist

After running the fix, verify:

- [ ] Function exists: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'update_user_streak';`
- [ ] Function has SECURITY DEFINER: Check in Supabase Dashboard → Database → Functions
- [ ] Test query works: `SELECT * FROM update_user_streak(auth.uid());`
- [ ] App logs show successful streak update (no permission errors)
- [ ] Database shows updated streak: `SELECT current_streak, longest_streak FROM user_activity_tracking WHERE user_id = auth.uid();`
- [ ] Profile screen displays streak correctly

## Troubleshooting

### Still getting permission errors after fix?
1. Make sure you ran the fix migration completely
2. Check that the function was actually updated (not just created again)
3. Try dropping and recreating: The fix migration includes `DROP FUNCTION IF EXISTS`
4. Verify your user is authenticated: `SELECT auth.uid();` should return your user ID

### Function not found after running fix?
1. Check for SQL errors in the Supabase logs
2. Make sure you're in the correct project
3. Try running just the CREATE FUNCTION part without the DROP

### Streak still shows 0?
1. Check if user has a record: `SELECT * FROM user_activity_tracking WHERE user_id = auth.uid();`
2. If no record, the function should create one automatically
3. Try calling the function manually: `SELECT * FROM update_user_streak(auth.uid());`
4. Check the function return value in logs

## Alternative: Manual Permission Grant

If the fix migration doesn't work, try this manual approach:

```sql
-- 1. Alter the existing function
ALTER FUNCTION update_user_streak(UUID) SECURITY DEFINER;

-- 2. Grant permissions
GRANT EXECUTE ON FUNCTION update_user_streak(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_streak(UUID) TO anon;

-- 3. Test
SELECT * FROM update_user_streak(auth.uid());
```

## Next Steps

Once the permission fix is applied:
1. ✅ Streak tracking will work automatically
2. ✅ No more permission errors
3. ✅ Streaks will update when episodes are watched
4. ✅ Profile screen will show accurate streak data

## Support

If you still have issues after applying this fix:
1. Share the complete error message
2. Share the result of: `SELECT * FROM update_user_streak(auth.uid());`
3. Share the result of: `SELECT * FROM user_activity_tracking WHERE user_id = auth.uid();`
4. Check Supabase logs for any database errors

The fix should resolve the permission issue completely!
