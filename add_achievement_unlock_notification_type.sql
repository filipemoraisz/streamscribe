-- Add 'achievement_unlock' to the notifications type check constraint

-- Drop the existing constraint
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the new constraint with 'achievement_unlock' included
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'episode_release', 
  'streaming_availability', 
  'recommendation', 
  'progress_sync', 
  'show_status', 
  'weekly_digest',
  'achievement_unlock'
));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.notifications'::regclass 
AND conname = 'notifications_type_check';
