-- ============================================
-- Fix Permissions for Streak Tracking Function
-- ============================================
-- This fixes the "permission denied for table users" error
-- by setting the function to run with SECURITY DEFINER

-- Drop and recreate the function with proper security settings
DROP FUNCTION IF EXISTS update_user_streak(UUID);

CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS TABLE(current_streak INTEGER, longest_streak INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER  -- This allows the function to bypass RLS
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
        INSERT INTO user_activity_tracking (user_id, current_streak, longest_streak, last_streak_date)
        VALUES (p_user_id, 1, 1, v_today);
        
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_user_streak(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_streak(UUID) TO anon;

-- Also fix the stale streaks function
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

-- Grant execute permission (mainly for service role/scheduled jobs)
GRANT EXECUTE ON FUNCTION check_and_reset_stale_streaks() TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_reset_stale_streaks() TO service_role;

-- ============================================
-- Success message
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Streak function permissions fixed!';
    RAISE NOTICE '🔒 Functions now run with SECURITY DEFINER';
    RAISE NOTICE '✅ Execute permissions granted to authenticated users';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Test with: SELECT * FROM update_user_streak(auth.uid());';
END $$;
