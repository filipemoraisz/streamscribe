-- Add read_at column to existing notifications table
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS read_at timestamp with time zone null;

-- Create index for read_at column for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_read_at 
ON public.notifications USING btree (read_at) TABLESPACE pg_default;

-- Add RLS policies if they don't exist
DO $$ 
BEGIN
    -- Check if RLS is enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'notifications' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Create policies if they don't exist
DO $$ 
BEGIN
    -- Policy for SELECT
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'notifications' 
        AND policyname = 'Users can view their own notifications'
    ) THEN
        CREATE POLICY "Users can view their own notifications"
        ON public.notifications FOR SELECT
        USING ( auth.uid() = user_id );
    END IF;

    -- Policy for INSERT
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'notifications' 
        AND policyname = 'Users can insert their own notifications'
    ) THEN
        CREATE POLICY "Users can insert their own notifications"
        ON public.notifications FOR INSERT
        WITH CHECK ( auth.uid() = user_id );
    END IF;

    -- Policy for UPDATE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'notifications' 
        AND policyname = 'Users can update their own notifications'
    ) THEN
        CREATE POLICY "Users can update their own notifications"
        ON public.notifications FOR UPDATE
        USING ( auth.uid() = user_id );
    END IF;
END $$;