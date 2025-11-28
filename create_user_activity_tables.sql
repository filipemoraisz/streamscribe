-- User Activity Tracking Table
-- Tracks user engagement patterns for re-engagement notifications
CREATE TABLE IF NOT EXISTS user_activity_tracking (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    last_app_open TIMESTAMP WITH TIME ZONE,
    last_episode_watched TIMESTAMP WITH TIME ZONE,
    last_watchlist_update TIMESTAMP WITH TIME ZONE,
    total_app_opens INTEGER DEFAULT 0,
    total_episodes_watched INTEGER DEFAULT 0,
    total_watchlist_updates INTEGER DEFAULT 0,
    total_hours_watched DECIMAL(10,2) DEFAULT 0,
    average_session_length INTEGER DEFAULT 0, -- in minutes
    preferred_watch_time TIME, -- HH:MM format for optimal notification timing
    weekly_watch_pattern INTEGER[] DEFAULT ARRAY[0,0,0,0,0,0,0], -- Days of week activity (0-6)
    engagement_score DECIMAL(3,2) DEFAULT 0, -- 0-1 score based on activity
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Re-engagement Notifications Table
-- Tracks sent re-engagement notifications to prevent spam
CREATE TABLE IF NOT EXISTS re_engagement_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    inactive_days INTEGER NOT NULL,
    engagement_type TEXT NOT NULL CHECK (engagement_type IN ('next_episode', 'watchlist_reminder', 'new_content', 'weekly_summary')),
    notification_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification History Table (extended for recommendation tracking)
-- This extends the existing notification_history table if it exists
CREATE TABLE IF NOT EXISTS notification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    content_id INTEGER,
    content_type TEXT,
    notification_data JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_last_app_open ON user_activity_tracking(last_app_open);
CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_last_episode_watched ON user_activity_tracking(last_episode_watched);
CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_engagement_score ON user_activity_tracking(engagement_score);

CREATE INDEX IF NOT EXISTS idx_re_engagement_notifications_user_id ON re_engagement_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_re_engagement_notifications_created_at ON re_engagement_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_re_engagement_notifications_engagement_type ON re_engagement_notifications(engagement_type);

CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_notification_type ON notification_history(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_history_content ON notification_history(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON notification_history(sent_at);

-- RLS Policies
ALTER TABLE user_activity_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_engagement_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

-- User activity tracking policies
CREATE POLICY "Users can view their own activity tracking" ON user_activity_tracking
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity tracking" ON user_activity_tracking
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity tracking" ON user_activity_tracking
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Service role can manage all activity tracking for background jobs
CREATE POLICY "Service role can manage activity tracking" ON user_activity_tracking
    FOR ALL TO service_role USING (true);

-- Re-engagement notifications policies
CREATE POLICY "Users can view their own re-engagement notifications" ON re_engagement_notifications
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage re-engagement notifications" ON re_engagement_notifications
    FOR ALL TO service_role USING (true);

-- Notification history policies
CREATE POLICY "Users can view their own notification history" ON notification_history
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification history" ON notification_history
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification history" ON notification_history
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage notification history" ON notification_history
    FOR ALL TO service_role USING (true);

-- Function to calculate engagement score
CREATE OR REPLACE FUNCTION calculate_engagement_score(
    p_total_episodes INTEGER,
    p_total_app_opens INTEGER,
    p_last_activity TIMESTAMP WITH TIME ZONE,
    p_account_age_days INTEGER
) RETURNS DECIMAL(3,2) AS $$
DECLARE
    activity_score DECIMAL(3,2) := 0;
    recency_score DECIMAL(3,2) := 0;
    frequency_score DECIMAL(3,2) := 0;
    final_score DECIMAL(3,2) := 0;
BEGIN
    -- Activity score (episodes watched)
    activity_score := LEAST(p_total_episodes / 100.0, 1.0);
    
    -- Recency score (how recent was last activity)
    IF p_last_activity IS NOT NULL THEN
        recency_score := GREATEST(0, 1.0 - (EXTRACT(EPOCH FROM (NOW() - p_last_activity)) / (30 * 24 * 3600))); -- 30 days max
    END IF;
    
    -- Frequency score (app opens per day)
    IF p_account_age_days > 0 THEN
        frequency_score := LEAST((p_total_app_opens::DECIMAL / p_account_age_days) / 2.0, 1.0); -- 2 opens per day = max score
    END IF;
    
    -- Weighted final score
    final_score := (activity_score * 0.4) + (recency_score * 0.4) + (frequency_score * 0.2);
    
    RETURN LEAST(final_score, 1.0);
END;
$$ LANGUAGE plpgsql;

-- Function to update engagement score
CREATE OR REPLACE FUNCTION update_engagement_score()
RETURNS TRIGGER AS $$
DECLARE
    account_age_days INTEGER;
BEGIN
    -- Calculate account age
    SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / (24 * 3600) INTO account_age_days
    FROM auth.users WHERE id = NEW.user_id;
    
    -- Update engagement score
    NEW.engagement_score := calculate_engagement_score(
        NEW.total_episodes_watched,
        NEW.total_app_opens,
        GREATEST(NEW.last_app_open, NEW.last_episode_watched, NEW.last_watchlist_update),
        COALESCE(account_age_days, 1)
    );
    
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update engagement score
CREATE TRIGGER update_user_activity_engagement_score
    BEFORE INSERT OR UPDATE ON user_activity_tracking
    FOR EACH ROW EXECUTE FUNCTION update_engagement_score();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at on user_activity_tracking
CREATE TRIGGER update_user_activity_tracking_updated_at 
    BEFORE UPDATE ON user_activity_tracking 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old notification history (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_notification_history()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete notification history older than 90 days
    DELETE FROM notification_history 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old re-engagement notifications older than 30 days
    DELETE FROM re_engagement_notifications 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a view for user engagement analytics
CREATE OR REPLACE VIEW user_engagement_analytics AS
SELECT 
    uat.user_id,
    uat.engagement_score,
    uat.total_episodes_watched,
    uat.total_app_opens,
    uat.last_app_open,
    uat.last_episode_watched,
    EXTRACT(EPOCH FROM (NOW() - GREATEST(uat.last_app_open, uat.last_episode_watched, uat.last_watchlist_update))) / (24 * 3600) AS days_since_last_activity,
    COUNT(ren.id) AS total_re_engagement_notifications,
    MAX(ren.created_at) AS last_re_engagement_notification
FROM user_activity_tracking uat
LEFT JOIN re_engagement_notifications ren ON uat.user_id = ren.user_id
GROUP BY uat.user_id, uat.engagement_score, uat.total_episodes_watched, uat.total_app_opens, 
         uat.last_app_open, uat.last_episode_watched, uat.last_watchlist_update;