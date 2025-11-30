/**
 * Achievement Backfill Script
 * 
 * This script calculates existing user progress and unlocks achievements
 * that users have already earned based on their historical data.
 * 
 * Run this as a one-time migration after the achievements system is deployed.
 * 
 * Usage:
 *   npx ts-node scripts/backfillAchievements.ts
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- EXPO_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Achievement {
  id: string;
  achievement_key: string;
  name: string;
  category: string;
  tier: string;
  unlock_criteria: {
    type: string;
    value: number;
    comparison?: string;
  };
}

interface UserProgress {
  userId: string;
  episodeCount: number;
  currentStreak: number;
  longestStreak: number;
  completedShows: number;
  totalSavings: number;
  monthlyEfficiency: number;
}

/**
 * Fetch all achievements from the database
 */
async function getAllAchievements(): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('sort_order');

  if (error) {
    throw new Error(`Failed to fetch achievements: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetch all users from the database
 */
async function getAllUsers(): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id');

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return (data || []).map(profile => profile.id);
}

/**
 * Calculate user progress across all achievement categories
 */
async function calculateUserProgress(userId: string): Promise<UserProgress> {
  // Get episode count
  const { count: episodeCount } = await supabase
    .from('episode_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('watched', true);

  // Get streak data from user_activity_tracking
  const { data: activityData } = await supabase
    .from('user_activity_tracking')
    .select('current_streak, longest_streak')
    .eq('user_id', userId)
    .single();

  // Get completed shows count
  const { count: completedShows } = await supabase
    .from('show_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');

  // Get savings and efficiency from user_impact_stats
  const { data: impactData } = await supabase
    .from('user_impact_stats')
    .select('total_savings, monthly_efficiency')
    .eq('user_id', userId)
    .single();

  return {
    userId,
    episodeCount: episodeCount || 0,
    currentStreak: activityData?.current_streak || 0,
    longestStreak: activityData?.longest_streak || 0,
    completedShows: completedShows || 0,
    totalSavings: impactData?.total_savings || 0,
    monthlyEfficiency: impactData?.monthly_efficiency || 0,
  };
}

/**
 * Check if a user meets the criteria for an achievement
 */
function meetsAchievementCriteria(
  progress: UserProgress,
  achievement: Achievement
): { meets: boolean; currentValue: number } {
  const { type, value, comparison = 'gte' } = achievement.unlock_criteria;
  let currentValue = 0;

  // Determine current value based on achievement type
  switch (type) {
    case 'episode_count':
      currentValue = progress.episodeCount;
      break;
    case 'streak_days':
      currentValue = progress.longestStreak; // Use longest streak for backfill
      break;
    case 'show_completions':
      currentValue = progress.completedShows;
      break;
    case 'total_savings':
      currentValue = progress.totalSavings;
      break;
    case 'monthly_efficiency':
      currentValue = progress.monthlyEfficiency;
      break;
    default:
      console.warn(`Unknown achievement type: ${type}`);
      return { meets: false, currentValue: 0 };
  }

  // Check if criteria is met based on comparison operator
  let meets = false;
  switch (comparison) {
    case 'gte':
      meets = currentValue >= value;
      break;
    case 'lte':
      meets = currentValue <= value;
      break;
    case 'eq':
      meets = currentValue === value;
      break;
    default:
      meets = currentValue >= value; // Default to gte
  }

  return { meets, currentValue };
}

/**
 * Unlock an achievement for a user
 */
async function unlockAchievement(
  userId: string,
  achievementId: string,
  progressValue: number
): Promise<boolean> {
  // Check if already unlocked
  const { data: existing } = await supabase
    .from('user_achievements')
    .select('id')
    .eq('user_id', userId)
    .eq('achievement_id', achievementId)
    .single();

  if (existing) {
    return false; // Already unlocked
  }

  // Insert new achievement unlock
  const { error } = await supabase
    .from('user_achievements')
    .insert({
      user_id: userId,
      achievement_id: achievementId,
      progress_value: progressValue,
      notified: false, // Will be notified on next app open
      notification_shown: false,
      push_sent: false,
    });

  if (error) {
    console.error(`Failed to unlock achievement: ${error.message}`);
    return false;
  }

  return true;
}

/**
 * Update achievement progress for partially completed achievements
 */
async function updateAchievementProgress(
  userId: string,
  achievementId: string,
  currentValue: number,
  targetValue: number
): Promise<void> {
  // Check if progress record exists
  const { data: existing } = await supabase
    .from('achievement_progress')
    .select('id')
    .eq('user_id', userId)
    .eq('achievement_id', achievementId)
    .single();

  if (existing) {
    // Update existing progress
    await supabase
      .from('achievement_progress')
      .update({
        current_value: currentValue,
        target_value: targetValue,
        last_updated: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    // Insert new progress record
    await supabase
      .from('achievement_progress')
      .insert({
        user_id: userId,
        achievement_id: achievementId,
        current_value: currentValue,
        target_value: targetValue,
      });
  }
}

/**
 * Process achievements for a single user
 */
async function processUserAchievements(
  userId: string,
  achievements: Achievement[]
): Promise<{ unlocked: number; updated: number }> {
  let unlockedCount = 0;
  let updatedCount = 0;

  // Calculate user progress
  const progress = await calculateUserProgress(userId);

  console.log(`Processing user ${userId}:`);
  console.log(`  Episodes: ${progress.episodeCount}`);
  console.log(`  Longest Streak: ${progress.longestStreak} days`);
  console.log(`  Completed Shows: ${progress.completedShows}`);
  console.log(`  Total Savings: $${progress.totalSavings.toFixed(2)}`);
  console.log(`  Monthly Efficiency: $${progress.monthlyEfficiency.toFixed(2)}/hour`);

  // Check each achievement
  for (const achievement of achievements) {
    const { meets, currentValue } = meetsAchievementCriteria(progress, achievement);

    if (meets) {
      // Unlock the achievement
      const unlocked = await unlockAchievement(
        userId,
        achievement.id,
        currentValue
      );

      if (unlocked) {
        console.log(`  ✓ Unlocked: ${achievement.name} (${achievement.tier})`);
        unlockedCount++;
      }
    } else if (currentValue > 0) {
      // Update progress for partially completed achievements
      await updateAchievementProgress(
        userId,
        achievement.id,
        currentValue,
        achievement.unlock_criteria.value
      );
      updatedCount++;
    }
  }

  return { unlocked: unlockedCount, updated: updatedCount };
}

/**
 * Main backfill function
 */
async function backfillAchievements() {
  console.log('=== Achievement Backfill Script ===\n');

  try {
    // Fetch all achievements
    console.log('Fetching achievements...');
    const achievements = await getAllAchievements();
    console.log(`Found ${achievements.length} achievements\n`);

    // Fetch all users
    console.log('Fetching users...');
    const userIds = await getAllUsers();
    console.log(`Found ${userIds.length} users\n`);

    if (userIds.length === 0) {
      console.log('No users found. Exiting.');
      return;
    }

    // Process each user
    let totalUnlocked = 0;
    let totalUpdated = 0;

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      console.log(`\n[${i + 1}/${userIds.length}] Processing user ${userId}...`);

      try {
        const { unlocked, updated } = await processUserAchievements(
          userId,
          achievements
        );

        totalUnlocked += unlocked;
        totalUpdated += updated;

        console.log(`  Unlocked: ${unlocked}, Progress Updated: ${updated}`);
      } catch (error) {
        console.error(`  Error processing user: ${error}`);
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Summary
    console.log('\n=== Backfill Complete ===');
    console.log(`Total users processed: ${userIds.length}`);
    console.log(`Total achievements unlocked: ${totalUnlocked}`);
    console.log(`Total progress records updated: ${totalUpdated}`);
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillAchievements()
  .then(() => {
    console.log('\nBackfill completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nBackfill failed:', error);
    process.exit(1);
  });
