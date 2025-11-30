-- =====================================================
-- Achievements System Database Schema
-- =====================================================
-- This migration creates the complete achievements system including:
-- - achievements table (achievement definitions)
-- - user_achievements table (user unlock tracking)
-- - achievement_progress table (progress tracking)
-- - achievement_notification_preferences table (user preferences)
-- - RLS policies for security
-- - Indexes for performance
-- - Automatic timestamp update functions
-- - Seed data for all 26 predefined achievements

-- =====================================================
-- 1. CREATE TABLES
-- =====================================================

-- Table: achievements
-- Stores the definition of all available achievements
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    achievement_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('viewing', 'streaks', 'completions', 'savings', 'efficiency')),
    tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    icon_name TEXT NOT NULL,
    icon_library TEXT NOT NULL DEFAULT 'Ionicons',
    unlock_criteria JSONB NOT NULL,
    points INTEGER NOT NULL DEFAULT 10,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: user_achievements
-- Tracks which achievements each user has unlocked
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    progress_value DECIMAL(10,2),
    notified BOOLEAN DEFAULT FALSE,
    notification_shown BOOLEAN DEFAULT FALSE,
    push_sent BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, achievement_id)
);

-- Table: achievement_progress
-- Tracks real-time progress toward locked achievements
CREATE TABLE IF NOT EXISTS achievement_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    current_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    target_value DECIMAL(10,2) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- Table: achievement_notification_preferences
-- Stores user preferences for achievement notifications
CREATE TABLE IF NOT EXISTS achievement_notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    in_app_full_screen BOOLEAN DEFAULT TRUE,
    in_app_banner BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    haptic_enabled BOOLEAN DEFAULT TRUE,
    progress_reminders BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. CREATE INDEXES
-- =====================================================

-- Indexes for user_achievements
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at ON user_achievements(unlocked_at);
CREATE INDEX IF NOT EXISTS idx_user_achievements_notification_shown ON user_achievements(notification_shown) WHERE notification_shown = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);

-- Indexes for achievement_progress
CREATE INDEX IF NOT EXISTS idx_achievement_progress_user_id ON achievement_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_achievement_progress_achievement_id ON achievement_progress(achievement_id);
CREATE INDEX IF NOT EXISTS idx_achievement_progress_last_updated ON achievement_progress(last_updated);

-- Indexes for achievements
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_achievements_tier ON achievements(tier);
CREATE INDEX IF NOT EXISTS idx_achievements_sort_order ON achievements(sort_order);

-- =====================================================
-- 3. CREATE FUNCTIONS FOR AUTOMATIC TIMESTAMP UPDATES
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for achievement_notification_preferences
DROP TRIGGER IF EXISTS update_achievement_notification_preferences_updated_at ON achievement_notification_preferences;
CREATE TRIGGER update_achievement_notification_preferences_updated_at
    BEFORE UPDATE ON achievement_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update last_updated timestamp for achievement_progress
CREATE OR REPLACE FUNCTION update_achievement_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for achievement_progress
DROP TRIGGER IF EXISTS update_achievement_progress_last_updated ON achievement_progress;
CREATE TRIGGER update_achievement_progress_last_updated
    BEFORE UPDATE ON achievement_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_achievement_progress_timestamp();

-- =====================================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_notification_preferences ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. CREATE RLS POLICIES
-- =====================================================

-- Policies for achievements table (public read access)
DROP POLICY IF EXISTS "Anyone can view achievements" ON achievements;
CREATE POLICY "Anyone can view achievements" 
    ON achievements FOR SELECT 
    USING (true);

-- Policies for user_achievements table
DROP POLICY IF EXISTS "Users can view their own achievements" ON user_achievements;
CREATE POLICY "Users can view their own achievements" 
    ON user_achievements FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own achievements" ON user_achievements;
CREATE POLICY "Users can insert their own achievements" 
    ON user_achievements FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own achievements" ON user_achievements;
CREATE POLICY "Users can update their own achievements" 
    ON user_achievements FOR UPDATE 
    USING (auth.uid() = user_id);

-- Policies for achievement_progress table
DROP POLICY IF EXISTS "Users can view their own progress" ON achievement_progress;
CREATE POLICY "Users can view their own progress" 
    ON achievement_progress FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own progress" ON achievement_progress;
CREATE POLICY "Users can insert their own progress" 
    ON achievement_progress FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own progress" ON achievement_progress;
CREATE POLICY "Users can update their own progress" 
    ON achievement_progress FOR UPDATE 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own progress" ON achievement_progress;
CREATE POLICY "Users can delete their own progress" 
    ON achievement_progress FOR DELETE 
    USING (auth.uid() = user_id);

-- Policies for achievement_notification_preferences table
DROP POLICY IF EXISTS "Users can view their own notification preferences" ON achievement_notification_preferences;
CREATE POLICY "Users can view their own notification preferences" 
    ON achievement_notification_preferences FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notification preferences" ON achievement_notification_preferences;
CREATE POLICY "Users can update their own notification preferences" 
    ON achievement_notification_preferences FOR UPDATE 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own notification preferences" ON achievement_notification_preferences;
CREATE POLICY "Users can insert their own notification preferences" 
    ON achievement_notification_preferences FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 6. SEED ACHIEVEMENT DATA
-- =====================================================

-- Clear existing achievements (for re-running migration)
-- TRUNCATE achievements CASCADE;

-- Insert all 26 predefined achievements

-- VIEWING MILESTONES (7 achievements)
INSERT INTO achievements (achievement_key, name, description, category, tier, icon_name, icon_library, unlock_criteria, points, sort_order) VALUES
('first_steps', 'First Steps', 'Watch your first episode', 'viewing', 'bronze', 'trophy-outline', 'Ionicons', '{"type": "episode_count", "value": 1, "comparison": "gte"}', 10, 1),
('getting_started', 'Getting Started', 'Watch 10 episodes', 'viewing', 'bronze', 'trophy-outline', 'Ionicons', '{"type": "episode_count", "value": 10, "comparison": "gte"}', 20, 2),
('binge_watcher', 'Binge Watcher', 'Watch 50 episodes', 'viewing', 'silver', 'trophy', 'Ionicons', '{"type": "episode_count", "value": 50, "comparison": "gte"}', 50, 3),
('series_enthusiast', 'Series Enthusiast', 'Watch 100 episodes', 'viewing', 'silver', 'trophy', 'Ionicons', '{"type": "episode_count", "value": 100, "comparison": "gte"}', 100, 4),
('tv_connoisseur', 'TV Connoisseur', 'Watch 250 episodes', 'viewing', 'gold', 'trophy', 'Ionicons', '{"type": "episode_count", "value": 250, "comparison": "gte"}', 200, 5),
('marathon_master', 'Marathon Master', 'Watch 500 episodes', 'viewing', 'gold', 'trophy', 'Ionicons', '{"type": "episode_count", "value": 500, "comparison": "gte"}', 300, 6),
('legendary_viewer', 'Legendary Viewer', 'Watch 1000 episodes', 'viewing', 'platinum', 'trophy', 'Ionicons', '{"type": "episode_count", "value": 1000, "comparison": "gte"}', 500, 7)
ON CONFLICT (achievement_key) DO NOTHING;

-- STREAK ACHIEVEMENTS (5 achievements)
INSERT INTO achievements (achievement_key, name, description, category, tier, icon_name, icon_library, unlock_criteria, points, sort_order) VALUES
('weekend_warrior', 'Weekend Warrior', 'Watch episodes on 3 consecutive days', 'streaks', 'bronze', 'flame-outline', 'Ionicons', '{"type": "streak_days", "value": 3, "comparison": "gte"}', 15, 8),
('week_streak', 'Week Streak', 'Watch episodes on 7 consecutive days', 'streaks', 'silver', 'flame', 'Ionicons', '{"type": "streak_days", "value": 7, "comparison": "gte"}', 50, 9),
('monthly_marathon', 'Monthly Marathon', 'Watch episodes on 30 consecutive days', 'streaks', 'gold', 'flame', 'Ionicons', '{"type": "streak_days", "value": 30, "comparison": "gte"}', 150, 10),
('century_streak', 'Century Streak', 'Watch episodes on 100 consecutive days', 'streaks', 'gold', 'flame', 'Ionicons', '{"type": "streak_days", "value": 100, "comparison": "gte"}', 300, 11),
('year_round_viewer', 'Year-Round Viewer', 'Watch episodes on 365 consecutive days', 'streaks', 'platinum', 'flame', 'Ionicons', '{"type": "streak_days", "value": 365, "comparison": "gte"}', 1000, 12)
ON CONFLICT (achievement_key) DO NOTHING;

-- SHOW COMPLETION ACHIEVEMENTS (5 achievements)
INSERT INTO achievements (achievement_key, name, description, category, tier, icon_name, icon_library, unlock_criteria, points, sort_order) VALUES
('series_finisher', 'Series Finisher', 'Complete your first show', 'completions', 'bronze', 'star-outline', 'Ionicons', '{"type": "show_completions", "value": 1, "comparison": "gte"}', 25, 13),
('completionist', 'Completionist', 'Complete 5 shows', 'completions', 'silver', 'star', 'Ionicons', '{"type": "show_completions", "value": 5, "comparison": "gte"}', 75, 14),
('series_collector', 'Series Collector', 'Complete 10 shows', 'completions', 'silver', 'star', 'Ionicons', '{"type": "show_completions", "value": 10, "comparison": "gte"}', 150, 15),
('finale_expert', 'Finale Expert', 'Complete 25 shows', 'completions', 'gold', 'star', 'Ionicons', '{"type": "show_completions", "value": 25, "comparison": "gte"}', 300, 16),
('ultimate_completionist', 'Ultimate Completionist', 'Complete 50 shows', 'completions', 'platinum', 'star', 'Ionicons', '{"type": "show_completions", "value": 50, "comparison": "gte"}', 750, 17)
ON CONFLICT (achievement_key) DO NOTHING;

-- ECONOMIC SAVINGS ACHIEVEMENTS (6 achievements)
INSERT INTO achievements (achievement_key, name, description, category, tier, icon_name, icon_library, unlock_criteria, points, sort_order) VALUES
('smart_saver', 'Smart Saver', 'Save $10 through optimization', 'savings', 'bronze', 'cash-outline', 'Ionicons', '{"type": "total_savings", "value": 10, "comparison": "gte"}', 20, 18),
('budget_master', 'Budget Master', 'Save $50 through optimization', 'savings', 'silver', 'cash', 'Ionicons', '{"type": "total_savings", "value": 50, "comparison": "gte"}', 75, 19),
('thrifty_viewer', 'Thrifty Viewer', 'Save $100 through optimization', 'savings', 'silver', 'cash', 'Ionicons', '{"type": "total_savings", "value": 100, "comparison": "gte"}', 150, 20),
('savings_expert', 'Savings Expert', 'Save $250 through optimization', 'savings', 'gold', 'cash', 'Ionicons', '{"type": "total_savings", "value": 250, "comparison": "gte"}', 300, 21),
('financial_guru', 'Financial Guru', 'Save $500 through optimization', 'savings', 'gold', 'cash', 'Ionicons', '{"type": "total_savings", "value": 500, "comparison": "gte"}', 500, 22),
('ultimate_optimizer', 'Ultimate Optimizer', 'Save $1000 through optimization', 'savings', 'platinum', 'cash', 'Ionicons', '{"type": "total_savings", "value": 1000, "comparison": "gte"}', 1000, 23)
ON CONFLICT (achievement_key) DO NOTHING;

-- EFFICIENCY AND OPTIMIZATION ACHIEVEMENTS (4 achievements)
INSERT INTO achievements (achievement_key, name, description, category, tier, icon_name, icon_library, unlock_criteria, points, sort_order) VALUES
('efficient_streamer', 'Efficient Streamer', 'Achieve monthly efficiency of $2 or less per hour', 'efficiency', 'silver', 'speedometer-outline', 'Ionicons', '{"type": "monthly_efficiency", "value": 2, "comparison": "lte"}', 50, 24),
('value_champion', 'Value Champion', 'Achieve monthly efficiency of $1 or less per hour', 'efficiency', 'gold', 'speedometer', 'Ionicons', '{"type": "monthly_efficiency", "value": 1, "comparison": "lte"}', 150, 25),
('optimization_master', 'Optimization Master', 'Achieve monthly efficiency of $0.50 or less per hour', 'efficiency', 'gold', 'speedometer', 'Ionicons', '{"type": "monthly_efficiency", "value": 0.5, "comparison": "lte"}', 300, 26),
('consistent_optimizer', 'Consistent Optimizer', 'Maintain optimal efficiency for 3 consecutive months', 'efficiency', 'platinum', 'speedometer', 'Ionicons', '{"type": "monthly_efficiency", "value": 1, "comparison": "lte", "consecutive_months": 3}', 500, 27)
ON CONFLICT (achievement_key) DO NOTHING;

-- =====================================================
-- 7. VERIFICATION QUERIES
-- =====================================================

-- Verify all tables were created
DO $$
BEGIN
    RAISE NOTICE 'Achievements System Migration Complete!';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - achievements';
    RAISE NOTICE '  - user_achievements';
    RAISE NOTICE '  - achievement_progress';
    RAISE NOTICE '  - achievement_notification_preferences';
    RAISE NOTICE '';
    RAISE NOTICE 'Total achievements seeded: %', (SELECT COUNT(*) FROM achievements);
    RAISE NOTICE '  - Viewing: %', (SELECT COUNT(*) FROM achievements WHERE category = 'viewing');
    RAISE NOTICE '  - Streaks: %', (SELECT COUNT(*) FROM achievements WHERE category = 'streaks');
    RAISE NOTICE '  - Completions: %', (SELECT COUNT(*) FROM achievements WHERE category = 'completions');
    RAISE NOTICE '  - Savings: %', (SELECT COUNT(*) FROM achievements WHERE category = 'savings');
    RAISE NOTICE '  - Efficiency: %', (SELECT COUNT(*) FROM achievements WHERE category = 'efficiency');
    RAISE NOTICE '';
    RAISE NOTICE 'By tier:';
    RAISE NOTICE '  - Bronze: %', (SELECT COUNT(*) FROM achievements WHERE tier = 'bronze');
    RAISE NOTICE '  - Silver: %', (SELECT COUNT(*) FROM achievements WHERE tier = 'silver');
    RAISE NOTICE '  - Gold: %', (SELECT COUNT(*) FROM achievements WHERE tier = 'gold');
    RAISE NOTICE '  - Platinum: %', (SELECT COUNT(*) FROM achievements WHERE tier = 'platinum');
END $$;

-- Sample query to view all achievements
-- SELECT achievement_key, name, category, tier, points, sort_order FROM achievements ORDER BY sort_order;
