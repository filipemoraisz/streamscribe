# Streak Tracking Database Migration Guide

## Overview
This guide walks you through running the `add_streak_and_impact_stats.sql` migration to add streak tracking functionality to your database.

## Prerequisites
- Access to Supabase Dashboard
- SQL Editor access in your Supabase project

## Migration Steps

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar

### Step 2: Execute the Migration
1. Click **New Query** button
2. Copy the entire contents of `add_streak_and_impact_stats.sql`
3. Paste into the SQL Editor
4. Click **Run** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

### Step 3: Verify Migration Success
After running the migration, you should see success messages in the output:

```
✅ Streak tracking added successfully!
📊 Columns added to user_activity_tracking:
   - longest_streak: Track personal best streak
   - last_streak_date: Track last watch date for streak calculation
   - optimized_hours: Track time saved
🔧 Functions created:
   - update_user_streak(user_id): Call when user watches an episode
   - check_and_reset_stale_streaks(): Run daily to reset inactive streaks

💡 Usage: SELECT * FROM update_user_streak('user-uuid-here');
```

### Step 4: Verify Columns Were Added
Run this query to verify the columns exist:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_activity_tracking'
AND column_name IN ('longest_streak', 'last_streak_date', 'optimized_hours');
```

You should see 3 rows returned with the new columns.

### Step 5: Test the update_user_streak Function
Test the function with your user ID:

```sql
-- Replace 'your-user-id-here' with an actual user UUID from your auth.users table
SELECT * FROM update_user_streak('your-user-id-here');
```

Expected output:
```
current_streak | longest_streak
---------------|---------------
1              | 1
```

### Step 6: Verify Function Behavior
Check that the user_activity_tracking record was updated:

```sql
-- Replace 'your-user-id-here' with the same user UUID
SELECT 
  user_id,
  current_streak,
  longest_streak,
  last_streak_date
FROM user_activity_tracking
WHERE user_id = 'your-user-id-here';
```

You should see:
- `current_streak`: 1
- `longest_streak`: 1
- `last_streak_date`: Today's date

## Troubleshooting

### Error: "relation user_activity_tracking does not exist"
**Solution:** The `user_activity_tracking` table needs to be created first. Run the `create_user_activity_tables.sql` migration before this one.

### Error: "column already exists"
**Solution:** The migration uses `ADD COLUMN IF NOT EXISTS`, so this shouldn't happen. If it does, the columns were already added and you can proceed.

### Error: "function update_user_streak already exists"
**Solution:** The migration uses `CREATE OR REPLACE FUNCTION`, so this will update the existing function. This is expected behavior.

### No rows returned when testing the function
**Solution:** Make sure you're using a valid user UUID from your `auth.users` table. You can find one with:

```sql
SELECT id FROM auth.users LIMIT 1;
```

## What This Migration Does

### 1. Adds Columns to user_activity_tracking
- `longest_streak` (INTEGER): Tracks the user's best streak ever
- `last_streak_date` (DATE): Tracks the last date the user watched an episode
- `optimized_hours` (DECIMAL): Tracks time saved through optimizations

### 2. Creates update_user_streak Function
This function:
- Calculates the current streak based on watch history
- Updates the longest streak if current exceeds it
- Handles streak continuation (watched yesterday = increment)
- Handles streak breaks (missed a day = reset to 1)
- Returns the current and longest streak values

### 3. Creates check_and_reset_stale_streaks Function
This function:
- Resets streaks for users who haven't watched in 2+ days
- Should be run daily via a scheduled job (cron)
- Returns the count of streaks that were reset

## Next Steps

After successfully running this migration:

1. ✅ The database schema is updated
2. ✅ The streak tracking functions are available
3. ✅ The app can now call `update_user_streak()` when episodes are watched
4. ✅ User stats will include streak information

The app code in `services/userActivity.ts` is already configured to use these functions.

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Remove the columns
ALTER TABLE user_activity_tracking 
DROP COLUMN IF EXISTS longest_streak,
DROP COLUMN IF EXISTS last_streak_date,
DROP COLUMN IF EXISTS optimized_hours;

-- Remove the functions
DROP FUNCTION IF EXISTS update_user_streak(UUID);
DROP FUNCTION IF EXISTS check_and_reset_stale_streaks();
```

## Support

If you encounter issues:
1. Check the Supabase logs for detailed error messages
2. Verify your database permissions
3. Ensure the `user_activity_tracking` table exists
4. Contact your database administrator if needed
