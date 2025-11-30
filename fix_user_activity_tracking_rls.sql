-- ============================================
-- Fix RLS Policies for user_activity_tracking
-- ============================================
-- This fixes permission issues when updating user activity tracking

-- First, check if RLS is enabled on the table
-- If it is, we need to add proper policies

-- Enable RLS if not already enabled (safe to run multiple times)
ALTER TABLE user_activity_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate them properly)
DROP POLICY IF EXISTS "Users can view their own activity" ON user_activity_tracking;
DROP POLICY IF EXISTS "Users can insert their own activity" ON user_activity_tracking;
DROP POLICY IF EXISTS "Users can update their own activity" ON user_activity_tracking;
DROP POLICY IF EXISTS "Service role has full access" ON user_activity_tracking;

-- Create comprehensive RLS policies

-- 1. Allow users to SELECT their own activity data
CREATE POLICY "Users can view their own activity"
ON user_activity_tracking
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2. Allow users to INSERT their own activity data
CREATE POLICY "Users can insert their own activity"
ON user_activity_tracking
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. Allow users to UPDATE their own activity data
CREATE POLICY "Users can update their own activity"
ON user_activity_tracking
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Allow service role full access (for functions and background jobs)
CREATE POLICY "Service role has full access"
ON user_activity_tracking
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- Also ensure the functions can bypass RLS
-- ============================================

-- Recreate update_user_streak with SECURITY DEFINER
DROP FUNCTION IF EXISTS update_user_streak(UUID);

CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS TABLE(current_streak INTEGER, longest_streak INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_last_streak_date DATE;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Get current streak data
    SELECT 
        uat.last_streak_date,
        uat.current_streak,
        uat.longest_streak
    INTO 
        v_last_streak_date,
        v_current_streak,
        v_longest_streak
    FROM user_activity_tracking uat
    WHERE uat.user_id = p_user_id;
    
    -- If no record exists, initialize
    IF NOT FOUND THEN
        INSERT INTO user_activity_tracking (
            user_id, 
            current_streak, 
            longest_streak, 
            last_streak_date,
            total_app_opens,
            total_episodes_watched,
            total_watchlist_updates,
            total_hours_watched,
            average_session_length,
            engagement_score,
            total_savings,
            monthly_efficiency,
            optimized_hours
        )
        VALUES (
            p_user_id, 
            1, 
            1, 
            v_today,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        );
        
        RETURN QUERY SELECT 1, 1;
        RETURN;
    END IF;
    
    -- Initialize if null
    v_current_streak := COALESCE(v_current_streak, 0);
    v_longest_streak := COALESCE(v_longest_streak, 0);
    
    -- Calculate new streak
    IF v_last_streak_date IS NULL THEN
        -- First time tracking
        v_current_streak := 1;
    ELSIF v_last_streak_date = v_today THEN
        -- Already watched today, no change
        NULL;
    ELSIF v_last_streak_date = v_today - INTERVAL '1 day' THEN
        -- Watched yesterday, increment streak
        v_current_streak := v_current_streak + 1;
    ELSE
        -- Streak broken, reset to 1
        v_current_streak := 1;
    END IF;
    
    -- Update longest streak if current is higher
    IF v_current_streak > v_longest_streak THEN
        v_longest_streak := v_current_streak;
    END IF;
    
    -- Update the record
    UPDATE user_activity_tracking
    SET 
        current_streak = v_current_streak,
        longest_streak = v_longest_streak,
        last_streak_date = v_today,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN QUERY SELECT v_current_streak, v_longest_streak;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_user_streak(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_streak(UUID) TO anon;
GRANT EXECUTE ON FUNCTION update_user_streak(UUID) TO service_role;

-- ============================================
-- Recreate check_and_reset_stale_streaks
-- ============================================

DROP FUNCTION IF EXISTS check_and_reset_stale_streaks();

CREATE OR REPLACE FUNCTION check_and_reset_stale_streaks()
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reset_count INTEGER := 0;
BEGIN
    -- Reset streaks for users who haven't watched in 2+ days
    UPDATE user_activity_tracking
    SET 
        current_streak = 0,
        updated_at = NOW()
    WHERE 
        last_streak_date < CURRENT_DATE - INTERVAL '1 day'
        AND current_streak > 0;
    
    GET DIAGNOSTICS v_reset_count = ROW_COUNT;
    
    RETURN v_reset_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_and_reset_stale_streaks() TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_reset_stale_streaks() TO service_role;

-- ============================================
-- Success message
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies configured for user_activity_tracking!';
    RAISE NOTICE '✅ Users can view/insert/update their own data';
    RAISE NOTICE '✅ Service role has full access';
    RAISE NOTICE '✅ Functions recreated with SECURITY DEFINER';
    RAISE NOTICE '✅ Execute permissions granted';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Test with: SELECT * FROM update_user_streak(auth.uid());';
    RAISE NOTICE '💡 Check policies: SELECT * FROM pg_policies WHERE tablename = ''user_activity_tracking'';';
END $$;
