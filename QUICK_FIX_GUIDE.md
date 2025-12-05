# Quick Fix for Streak Tracking Permission Error

## The Problem
```
ERROR: permission denied for table users (code: 42501)
```

This happens because the `user_activity_tracking` table has Row Level Security (RLS) enabled, but the policies aren't configured properly.

## The Solution (2 Minutes)

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar

### Step 2: Run This Migration
1. Click **New Query**
2. Copy ALL the contents of `fix_user_activity_tracking_rls.sql`
3. Paste into the editor
4. Click **Run** (or press Ctrl+Enter / Cmd+Enter)

### Step 3: Verify Success
You should see:
```
✅ RLS policies configured for user_activity_tracking!
✅ Users can view/insert/update their own data
✅ Service role has full access
✅ Functions recreated with SECURITY DEFINER
✅ Execute permissions granted
```

### Step 4: Reload Your App
- iOS: Press `Cmd + R`
- Android: Press `R` twice
- Physical device: Shake and select "Reload"

### Step 5: Test
Mark an episode as watched. You should now see:
```
LOG  [UserActivity] Streak updated - Current: 1, Longest: 1
LOG  [UserActivity] ✅ Activity tracking updated successfully
LOG  [Progress] ✅ Streak and activity tracking updated
```

**No more errors!** ✅

## What This Fix Does

1. **Configures RLS Policies** - Allows users to access their own data
2. **Adds SECURITY DEFINER** - Allows functions to bypass RLS
3. **Grants Permissions** - Ensures authenticated users can execute functions
4. **Initializes Records** - Function creates user record if it doesn't exist

## Verification

After running the fix, test with this query:
```sql
-- Test the function
SELECT * FROM update_user_streak(auth.uid());

-- Check your activity record
SELECT * FROM user_activity_tracking WHERE user_id = auth.uid();

-- Verify policies exist
SELECT * FROM pg_policies WHERE tablename = 'user_activity_tracking';
```

## Still Having Issues?

If you still see errors after running the fix:

1. **Check if the migration ran successfully** - Look for error messages in Supabase
2. **Verify RLS is enabled** - Run: `SELECT tablename FROM pg_tables WHERE tablename = 'user_activity_tracking';`
3. **Check function exists** - Run: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'update_user_streak';`
4. **Share the error** - Copy the complete error message and share it

## Why This Happened

Supabase enables RLS by default for security. The `user_activity_tracking` table had RLS enabled but didn't have policies that allowed:
- Users to UPDATE their own records
- Functions to bypass RLS with SECURITY DEFINER

This fix adds both!

---

**That's it!** Run the migration and your streak tracking will work perfectly. 🎉
