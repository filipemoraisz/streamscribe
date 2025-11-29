# Database Migration Required: Add quiet_hours Column

## Error
```
Could not find the 'quiet_hours' column of 'notification_preferences' in the schema cache
```

## Problem
The `notification_preferences` table in your Supabase database is missing the `quiet_hours` column that the app is trying to use.

## Solution
You need to run the migration SQL to add the missing column to your database.

### Steps to Fix:

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor

2. **Run the Migration**
   - Open the file: `add_quiet_hours_column.sql`
   - Copy the entire SQL content
   - Paste it into the Supabase SQL Editor
   - Click "Run" to execute the migration

3. **Verify the Migration**
   - The migration will:
     - Add the `quiet_hours` column if it doesn't exist
     - Set default values for existing rows
     - Show success messages in the output

### Alternative: Create Fresh Table
If you prefer to recreate the entire table (⚠️ **This will delete existing data**):

1. Open `create_notification_preferences.sql`
2. Run it in the Supabase SQL Editor
3. This will create the table with all required columns including `quiet_hours`

## What the quiet_hours Column Does
The `quiet_hours` column stores user preferences for when they don't want to receive notifications:

```json
{
  "enabled": false,
  "start": "22:00",
  "end": "08:00"
}
```

- **enabled**: Whether quiet hours are active
- **start**: Start time in HH:MM format (24-hour)
- **end**: End time in HH:MM format (24-hour)

## After Migration
Once the migration is complete:
1. Restart your app
2. The notification settings screen will work properly
3. Users can configure their quiet hours preferences
4. The error will no longer appear

## Files Involved
- `add_quiet_hours_column.sql` - Migration to add the column
- `create_notification_preferences.sql` - Full table schema
- `services/notificationSync.ts` - Service that uses the column
- `app/notification-settings.tsx` - UI that displays the settings
