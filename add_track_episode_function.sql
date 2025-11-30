-- ============================================
-- Add Function to Track Episode Watched
-- ============================================
-- This function updates episode count and hours watched
-- It runs with SECURITY DEFINER to bypass RLS

CREATE OR REPLACE FUNCTION track_episode_watched(
    p_user_id UUID,
    p_runtime_minutes INTEGER DEFAULT 45
)
RETURNS TABLE(
    total_episodes INTEGER,
    total_hours DECIMAL
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_episodes INTEGER;
    v_current_hours DECIMAL;
    v_new_episodes INTEGER;
    v_new_hours DECIMAL;
    v_hours_to_add DECIMAL;
BEGIN
    -- Calculate hours from runtime
    v_hours_to_add := p_runtime_minutes::DECIMAL / 60.0;
    
    -- Get current values
    SELECT 
        total_episodes_watched,
        total_hours_watched
    INTO 
        v_current_episodes,
        v_current_hours
    FROM user_activity_tracking
    WHERE user_id = p_user_id;
    
    -- If no record exists, initialize it
    IF NOT FOUND THEN
        INSERT INTO user_activity_tracking (
            user_id,
            total_episodes_watched,
            total_hours_watched,
            last_episode_watched,
            current_streak,
            longest_streak,
            total_app_opens,
            total_watchlist_updates,
            average_session_length,
            engagement_score,
            total_savings,
            monthly_efficiency,
            optimized_hours,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            1,
            v_hours_to_add,
            NOW(),
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            NOW(),
            NOW()
        );
        
        RETURN QUERY SELECT 1, v_hours_to_add;
        RETURN;
    END IF;
    
    -- Calculate new values
    v_new_episodes := COALESCE(v_current_episodes, 0) + 1;
    v_new_hours := COALESCE(v_current_hours, 0) + v_hours_to_add;
    
    -- Update the record
    UPDATE user_activity_tracking
    SET 
        total_episodes_watched = v_new_episodes,
        total_hours_watched = v_new_hours,
        last_episode_watched = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN QUERY SELECT v_new_episodes, v_new_hours;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION track_episode_watched(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION track_episode_watched(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION track_episode_watched(UUID, INTEGER) TO service_role;

-- ============================================
-- Success message
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ track_episode_watched function created!';
    RAISE NOTICE '🔒 Function runs with SECURITY DEFINER';
    RAISE NOTICE '✅ Execute permissions granted';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Usage: SELECT * FROM track_episode_watched(auth.uid(), 45);';
    RAISE NOTICE '💡 This will increment episode count and add hours watched';
END $$;
