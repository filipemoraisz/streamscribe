# Leaving Soon Section - Setup Guide

## Why the "Leaving Soon" Section Isn't Showing

The "Leaving Soon" section requires data in the `streaming_availability_changes` database table. This table is normally populated by a background job that monitors streaming service availability changes.

## Current Behavior

The section will **hide automatically** when:
1. The `streaming_availability_changes` table is empty
2. No content is leaving within the next 30 days
3. The user has no subscribed services configured
4. There are no matches between leaving content and the user's subscribed services

## How to Test the Section

### Option 1: Insert Mock Data (Recommended for Testing)

Run the SQL script `insert_mock_leaving_soon_data.sql` in your Supabase SQL editor:

```bash
# The file contains mock data for popular movies and TV shows leaving various services
```

This will insert test data for:
- Movies: Fight Club, Forrest Gump, The Shawshank Redemption, The Godfather, Schindler's List
- TV Shows: Breaking Bad, Game of Thrones, The Big Bang Theory, The Flash, The Walking Dead

### Option 2: Set Up Background Monitoring (Production)

For production use, you need to:

1. **Create a background job** that periodically checks streaming availability
2. **Use a streaming availability API** (like JustWatch API or similar)
3. **Populate the table** with real leaving_soon data

Example background job structure:
```typescript
// This would run as a Supabase Edge Function or cron job
async function monitorStreamingAvailability() {
  // 1. Fetch current availability from streaming API
  // 2. Compare with previous availability
  // 3. Detect changes (added, removed, leaving_soon)
  // 4. Insert into streaming_availability_changes table
}
```

## Debugging

Check the console logs for these messages:
- `"Leaving Soon items fetched: X"` - Shows how many items were loaded
- `"No subscribed services found for user"` - User needs to configure services in preferences
- `"Streaming availability changes found: X"` - Shows database query results
- `"No content leaving soon in the next 30 days"` - Table is empty or no matches

## User Prerequisites

For the section to show, users must have:

1. **Subscribed services configured** in their user preferences:
   ```sql
   SELECT subscribed_services FROM user_preferences WHERE user_id = 'your-user-id';
   ```

2. **Content in the database** that matches their services:
   ```sql
   SELECT * FROM streaming_availability_changes 
   WHERE change_type = 'leaving_soon' 
   AND leaving_date > NOW() 
   AND leaving_date < NOW() + INTERVAL '30 days';
   ```

## Quick Fix for Development

If you just want to see the section working during development:

1. Run `insert_mock_leaving_soon_data.sql` in Supabase
2. Ensure your user has subscribed services set (netflix, hulu, or amazon_prime)
3. Refresh the home screen

The section should now appear with the mock content!

## Filter Behavior

The "Leaving Soon" section respects the active filter:
- **All**: Shows both movies and TV shows
- **Movies**: Shows only movies leaving soon
- **TV Shows**: Shows only TV shows leaving soon
