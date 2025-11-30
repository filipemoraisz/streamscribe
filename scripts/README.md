# Achievement Backfill Script

This directory contains the one-time migration script to backfill achievements for existing users.

## Overview

The `backfillAchievements.ts` script:
- Calculates existing user progress across all achievement categories
- Checks all achievement criteria against current user data
- Unlocks achievements that users have already earned
- Updates achievement_progress for partially completed achievements
- Inserts records into user_achievements table

## Prerequisites

1. Node.js and npm/yarn installed
2. ts-node installed globally or as a dev dependency
3. Environment variables configured:
   - `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (with admin privileges)

## Installation

If ts-node is not installed:

```bash
npm install -g ts-node
# or
yarn global add ts-node
```

## Running the Script

### Option 1: Using ts-node directly

```bash
npx ts-node scripts/backfillAchievements.ts
```

### Option 2: Using environment variables from .env file

```bash
# Load environment variables and run
export $(cat .env | xargs) && npx ts-node scripts/backfillAchievements.ts
```

### Option 3: Add to package.json scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "backfill-achievements": "ts-node scripts/backfillAchievements.ts"
  }
}
```

Then run:

```bash
npm run backfill-achievements
```

## What the Script Does

1. **Fetches all achievements** from the database
2. **Fetches all users** from the profiles table
3. **For each user**, it:
   - Calculates their current progress:
     - Episode count (from episode_progress)
     - Current and longest streak (from user_activity_tracking)
     - Completed shows (from show_progress)
     - Total savings and monthly efficiency (from user_impact_stats)
   - Checks each achievement's criteria
   - Unlocks achievements they've already earned
   - Updates progress for partially completed achievements
4. **Outputs a summary** of total achievements unlocked and progress records updated

## Output Example

```
=== Achievement Backfill Script ===

Fetching achievements...
Found 15 achievements

Fetching users...
Found 42 users

[1/42] Processing user abc123...
Processing user abc123:
  Episodes: 25
  Longest Streak: 7 days
  Completed Shows: 2
  Total Savings: $45.50
  Monthly Efficiency: $12.30/hour
  ✓ Unlocked: First Steps (bronze)
  ✓ Unlocked: Getting Started (bronze)
  Unlocked: 2, Progress Updated: 8

...

=== Backfill Complete ===
Total users processed: 42
Total achievements unlocked: 87
Total progress records updated: 456

Backfill completed successfully!
```

## Important Notes

- This script uses the **service role key** which has admin privileges
- The script includes a 100ms delay between users to avoid rate limiting
- Already unlocked achievements are skipped automatically
- The script is idempotent - safe to run multiple times
- Users will be notified of unlocked achievements on their next app open
- Run this script **after** deploying the achievements system to production

## Troubleshooting

### Missing environment variables
Ensure both `EXPO_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.

### Permission errors
Make sure you're using the service role key, not the anon key.

### Database errors
Verify that all required tables exist:
- achievements
- user_achievements
- achievement_progress
- profiles
- episode_progress
- user_activity_tracking
- show_progress
- user_impact_stats

### Rate limiting
If you encounter rate limiting, increase the delay in the script (currently 100ms).
