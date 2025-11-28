/// <reference path="../types.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RecommendationNotificationPayload {
  id: string;
  type: 'recommendation';
  title: string;
  body: string;
  data: {
    recommendationType: 'new_content' | 'weekly_digest' | 'trending' | 'genre_match' | 'show_status' | 're_engagement';
    [key: string]: any;
  };
  priority: 'high' | 'normal' | 'low';
  scheduledFor?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action } = await req.json()

    switch (action) {
      case 'process_new_content_recommendations':
        return await processNewContentRecommendations(supabaseClient)
      
      case 'process_show_status_updates':
        return await processShowStatusUpdates(supabaseClient)
      
      case 'process_re_engagement_notifications':
        return await processReEngagementNotifications(supabaseClient)
      
      case 'generate_weekly_digests':
        return await generateWeeklyDigests(supabaseClient)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

  } catch (error) {
    console.error('Error in recommendation-notifications function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function processNewContentRecommendations(supabase: any) {
  console.log('Processing new content recommendations...')
  
  try {
    // Get users who have recommendation notifications enabled
    const { data: users, error: usersError } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('recommendations', true)

    if (usersError) throw usersError

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users with recommendation notifications enabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing recommendations for ${users.length} users`)

    // Get trending content from TMDB (simplified - in real implementation, you'd call TMDB API)
    const trendingContent = await getTrendingContent()
    
    let notificationsCreated = 0

    for (const user of users) {
      try {
        // Get user's genre preferences and subscribed services
        const userPrefs = await getUserPreferences(supabase, user.user_id)
        if (!userPrefs) continue

        // Filter content based on user preferences
        const filteredContent = await filterContentForUser(trendingContent, userPrefs)
        
        if (filteredContent.length === 0) continue

        // Create notifications for top content
        for (const content of filteredContent.slice(0, 2)) { // Limit to 2 per user
          const notification: RecommendationNotificationPayload = {
            id: `rec_${content.id}_${user.user_id}_${Date.now()}`,
            type: 'recommendation',
            title: `New Recommendation: ${content.title}`,
            body: `${content.genres.join(', ')} • ${content.rating}/10 • Trending now`,
            data: {
              recommendationType: 'new_content',
              contentId: content.id,
              contentType: content.type,
              contentTitle: content.title,
              rating: content.rating
            },
            priority: content.rating > 8.5 ? 'high' : 'normal'
          }

          // Send push notification
          await sendPushNotification(supabase, user.user_id, notification)
          notificationsCreated++
        }

      } catch (error) {
        console.error(`Error processing recommendations for user ${user.user_id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed new content recommendations`,
        notificationsCreated,
        usersProcessed: users.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing new content recommendations:', error)
    throw error
  }
}

async function processShowStatusUpdates(supabase: any) {
  console.log('Processing show status updates...')
  
  try {
    // Get shows that need status checking (haven't been checked in 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: showsToCheck, error: showsError } = await supabase
      .from('show_status_cache')
      .select('show_id, status')
      .lt('last_checked', oneDayAgo)
      .limit(50) // Process in batches

    if (showsError) throw showsError

    if (!showsToCheck || showsToCheck.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No shows need status checking' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Checking status for ${showsToCheck.length} shows`)

    let statusUpdatesFound = 0

    for (const show of showsToCheck) {
      try {
        // Get current status from TMDB (simplified)
        const currentStatus = await getShowStatusFromTMDB(show.show_id)
        
        if (currentStatus && currentStatus !== show.status) {
          // Status has changed - find users who have this show in watchlist
          const usersWithShow = await getUsersWithShowInWatchlist(supabase, show.show_id)
          
          for (const userId of usersWithShow) {
            // Create status notification
            const notification: RecommendationNotificationPayload = {
              id: `status_${show.show_id}_${userId}_${Date.now()}`,
              type: 'recommendation',
              title: getStatusNotificationTitle(currentStatus),
              body: `${show.title || 'Your show'} status has been updated`,
              data: {
                recommendationType: 'show_status',
                showId: show.show_id,
                statusType: determineStatusType(show.status, currentStatus),
                newStatus: currentStatus,
                previousStatus: show.status
              },
              priority: ['cancelled', 'renewed'].includes(currentStatus) ? 'high' : 'normal'
            }

            await sendPushNotification(supabase, userId, notification)
          }

          // Update cached status
          await supabase
            .from('show_status_cache')
            .upsert({
              show_id: show.show_id,
              status: currentStatus,
              last_checked: new Date().toISOString()
            })

          statusUpdatesFound++
        } else {
          // No status change, just update last_checked
          await supabase
            .from('show_status_cache')
            .update({ last_checked: new Date().toISOString() })
            .eq('show_id', show.show_id)
        }

      } catch (error) {
        console.error(`Error checking status for show ${show.show_id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed show status updates`,
        statusUpdatesFound,
        showsChecked: showsToCheck.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing show status updates:', error)
    throw error
  }
}

async function processReEngagementNotifications(supabase: any) {
  console.log('Processing re-engagement notifications...')
  
  try {
    // Get users who haven't been active in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: inactiveUsers, error: usersError } = await supabase
      .from('user_activity_tracking')
      .select('user_id, last_app_open, last_episode_watched, engagement_score')
      .or(`last_app_open.lt.${sevenDaysAgo},last_episode_watched.lt.${sevenDaysAgo}`)
      .gt('engagement_score', 0.1) // Only re-engage users who were previously engaged

    if (usersError) throw usersError

    if (!inactiveUsers || inactiveUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No inactive users found for re-engagement' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing re-engagement for ${inactiveUsers.length} inactive users`)

    let reEngagementNotificationsSent = 0

    for (const user of inactiveUsers) {
      try {
        // Check if we've already sent a re-engagement notification recently
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        
        const { data: recentNotification } = await supabase
          .from('re_engagement_notifications')
          .select('id')
          .eq('user_id', user.user_id)
          .gte('created_at', threeDaysAgo)
          .limit(1)

        if (recentNotification && recentNotification.length > 0) {
          continue // Skip if already sent recently
        }

        // Calculate inactive days
        const lastActivity = Math.max(
          new Date(user.last_app_open || 0).getTime(),
          new Date(user.last_episode_watched || 0).getTime()
        )
        const inactiveDays = Math.floor((Date.now() - lastActivity) / (1000 * 60 * 60 * 24))

        // Get user's next episodes to watch
        const nextEpisodes = await getNextEpisodesToWatch(supabase, user.user_id)

        let notification: RecommendationNotificationPayload

        if (nextEpisodes.length > 0) {
          // Next episode strategy
          const firstEpisode = nextEpisodes[0] as any
          notification = {
            id: `reeng_${user.user_id}_${Date.now()}`,
            type: 'recommendation',
            title: `📺 Ready to continue ${firstEpisode.showTitle}?`,
            body: `S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber} is waiting for you`,
            data: {
              recommendationType: 're_engagement',
              engagementType: 'next_episode',
              inactiveDays,
              nextEpisodes: nextEpisodes.slice(0, 3)
            },
            priority: 'normal'
          }
        } else {
          // General re-engagement
          notification = {
            id: `reeng_${user.user_id}_${Date.now()}`,
            type: 'recommendation',
            title: `🎬 Your watchlist is waiting!`,
            body: `Discover what's new since your last visit`,
            data: {
              recommendationType: 're_engagement',
              engagementType: 'watchlist_reminder',
              inactiveDays
            },
            priority: 'low'
          }
        }

        await sendPushNotification(supabase, user.user_id, notification)

        // Record re-engagement notification
        await supabase
          .from('re_engagement_notifications')
          .insert({
            user_id: user.user_id,
            inactive_days: inactiveDays,
            engagement_type: nextEpisodes.length > 0 ? 'next_episode' : 'watchlist_reminder'
          })

        reEngagementNotificationsSent++

      } catch (error) {
        console.error(`Error processing re-engagement for user ${user.user_id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed re-engagement notifications`,
        notificationsSent: reEngagementNotificationsSent,
        inactiveUsersProcessed: inactiveUsers.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing re-engagement notifications:', error)
    throw error
  }
}

async function generateWeeklyDigests(supabase: any) {
  console.log('Generating weekly digests...')
  
  try {
    // Check if it's Monday (day 1)
    const today = new Date()
    if (today.getDay() !== 1) {
      return new Response(
        JSON.stringify({ message: 'Weekly digests are only generated on Mondays' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get users who want weekly digest notifications
    const { data: users, error: usersError } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('recommendations', true)
      .eq('frequency', 'weekly')

    if (usersError) throw usersError

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users configured for weekly digests' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Generating weekly digests for ${users.length} users`)

    let digestsSent = 0

    for (const user of users) {
      try {
        // Get user's weekly stats and recommendations
        const weeklyStats = await getWeeklyStatsForUser(supabase, user.user_id)
        const topRecommendations = await getTopRecommendationsForUser(supabase, user.user_id)

        if (topRecommendations.length === 0) continue

        const notification: RecommendationNotificationPayload = {
          id: `digest_${user.user_id}_${Date.now()}`,
          type: 'recommendation',
          title: 'Your Weekly StreamScribe Digest',
          body: `${topRecommendations.length} new recommendations based on your taste`,
          data: {
            recommendationType: 'weekly_digest',
            digestItems: topRecommendations,
            weeklyStats
          },
          priority: 'normal'
        }

        await sendPushNotification(supabase, user.user_id, notification)
        digestsSent++

      } catch (error) {
        console.error(`Error generating weekly digest for user ${user.user_id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Generated weekly digests`,
        digestsSent,
        usersProcessed: users.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error generating weekly digests:', error)
    throw error
  }
}

// Helper functions (simplified implementations)

async function getTrendingContent() {
  // In real implementation, this would call TMDB API
  return [
    { id: 1, title: 'Trending Movie 1', type: 'movie', rating: 8.5, genres: ['Action', 'Thriller'] },
    { id: 2, title: 'Trending Show 1', type: 'tv', rating: 9.0, genres: ['Drama', 'Sci-Fi'] }
  ]
}

async function getUserPreferences(supabase: any, userId: string) {
  const { data } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  return data
}

async function filterContentForUser(content: any[], userPrefs: any) {
  // Simplified filtering - in real implementation, this would be more sophisticated
  return content.filter(item => item.rating > 8.0)
}

async function sendPushNotification(supabase: any, userId: string, notification: RecommendationNotificationPayload) {
  // Get user's push tokens
  const { data: tokens } = await supabase
    .from('user_push_tokens')
    .select('push_token')
    .eq('user_id', userId)

  if (!tokens || tokens.length === 0) {
    console.log(`No push tokens found for user ${userId}`)
    return
  }

  // In real implementation, you would send to Expo Push API
  console.log(`Sending notification to ${tokens.length} devices for user ${userId}:`, notification.title)
  
  // Store notification in history
  await supabase
    .from('notification_history')
    .insert({
      user_id: userId,
      notification_type: 'recommendation',
      notification_data: notification
    })
}

async function getShowStatusFromTMDB(showId: number) {
  // Simplified - in real implementation, call TMDB API
  return 'Returning Series'
}

async function getUsersWithShowInWatchlist(supabase: any, showId: number) {
  // This would need to be implemented based on your watchlist storage
  return []
}

async function getNextEpisodesToWatch(supabase: any, userId: string) {
  // Simplified implementation
  return []
}

async function getWeeklyStatsForUser(supabase: any, userId: string) {
  return { episodesWatched: 5, hoursWatched: 4, showsCompleted: 1 }
}

async function getTopRecommendationsForUser(supabase: any, userId: string) {
  return [
    { id: 1, title: 'Recommended Show', rating: 9.0, genres: ['Drama'] }
  ]
}

function getStatusNotificationTitle(status: string) {
  switch (status) {
    case 'renewed': return '📺 Great News!'
    case 'cancelled': return '😞 Show Update'
    case 'ended': return '🎬 Series Finale'
    default: return '📺 Show Update'
  }
}

function determineStatusType(oldStatus: string, newStatus: string) {
  if (newStatus.includes('cancel')) return 'cancelled'
  if (newStatus.includes('end')) return 'ended'
  if (newStatus.includes('renew') || newStatus.includes('return')) return 'renewed'
  return 'returning'
}