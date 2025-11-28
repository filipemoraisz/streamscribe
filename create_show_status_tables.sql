-- Show Status Cache Table
-- Stores the current status of shows to detect changes
CREATE TABLE IF NOT EXISTS show_status_cache (
    show_id INTEGER PRIMARY KEY,
    status TEXT NOT NULL,
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tmdb_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Show Status Notifications Table
-- Tracks which status notifications have been sent to prevent duplicates
CREATE TABLE IF NOT EXISTS show_status_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    show_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    status_type TEXT NOT NULL CHECK (status_type IN ('renewed', 'cancelled', 'ended', 'returning')),
    notification_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate notifications for same user/show/status
    UNIQUE(user_id, show_id, status)
);

-- Show Status Preferences Table
-- User preferences for which types of show status notifications they want
CREATE TABLE IF NOT EXISTS show_status_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    notify_renewed BOOLEAN DEFAULT TRUE,
    notify_cancelled BOOLEAN DEFAULT TRUE,
    notify_ended BOOLEAN DEFAULT TRUE,
    notify_returning BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_show_status_cache_last_checked ON show_status_cache(last_checked);
CREATE INDEX IF NOT EXISTS idx_show_status_notifications_user_id ON show_status_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_show_status_notifications_show_id ON show_status_notifications(show_id);
CREATE INDEX IF NOT EXISTS idx_show_status_notifications_created_at ON show_status_notifications(created_at);

-- RLS Policies
ALTER TABLE show_status_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_status_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_status_preferences ENABLE ROW LEVEL SECURITY;

-- Show status cache is readable by all authenticated users (for efficiency)
CREATE POLICY "Show status cache is readable by authenticated users" ON show_status_cache
    FOR SELECT TO authenticated USING (true);

-- Show status cache is writable by service role only
CREATE POLICY "Show status cache is writable by service role" ON show_status_cache
    FOR ALL TO service_role USING (true);

-- Show status notifications are only accessible by the user
CREATE POLICY "Users can view their own show status notifications" ON show_status_notifications
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own show status notifications" ON show_status_notifications
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Show status preferences are only accessible by the user
CREATE POLICY "Users can view their own show status preferences" ON show_status_preferences
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own show status preferences" ON show_status_preferences
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own show status preferences" ON show_status_preferences
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_show_status_cache_updated_at 
    BEFORE UPDATE ON show_status_cache 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_show_status_preferences_updated_at 
    BEFORE UPDATE ON show_status_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();