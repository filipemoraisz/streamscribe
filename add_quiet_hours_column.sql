-- Migration: Add quiet_hours column to notification_preferences table
-- This migration safely adds the quiet_hours column if it doesn't exist

-- Add quiet_hours column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_preferences' 
    AND column_name = 'quiet_hours'
  ) THEN
    ALTER TABLE public.notification_preferences 
    ADD COLUMN quiet_hours jsonb DEFAULT '{"enabled": false, "start": "22:00", "end": "08:00"}'::jsonb;
    
    RAISE NOTICE 'Added quiet_hours column to notification_preferences table';
  ELSE
    RAISE NOTICE 'quiet_hours column already exists in notification_preferences table';
  END IF;
END $$;

-- Update existing rows to have the default quiet_hours value if they are null
UPDATE public.notification_preferences
SET quiet_hours = '{"enabled": false, "start": "22:00", "end": "08:00"}'::jsonb
WHERE quiet_hours IS NULL;

RAISE NOTICE 'Migration completed successfully';
