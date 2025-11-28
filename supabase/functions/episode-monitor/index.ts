/// <reference path="../types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NewEpisode {
  showId: number;
  showName: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string;
  airDate: string;
  overview: string;
  stillPath: string | null;
}

interface EpisodeCache {
  show_id: number;
  last_checked: string;
  latest_season: number;
  latest_episode: number;
  latest_air_date: string;
}

interface UserNotificationPrefs {
  user_id: string;
  episode_releases: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const tmdbApiKey = Deno.env.get('TMDB_API_KEY')
    if (!tmdbApiKey) {
      throw new Error('TMDB_API_KEY not configured')
    }

    console.log('Starting episode monitoring job')

    // Get all unique TV shows from user watchlists
    const { data: watchlistShows, error: watchlistError } = await supabaseClient
      .from('watchlists')
      .select('tmdb_id, user_id')
      .eq('media_type', 'tv')

    if (watchlistError) {
      throw new Error(`Failed to fetch watchlist: ${watchlistError.message}`)
    }

    if (!watchlistShows || watchlistShows.length === 0) {
      console.log('No TV shows in any watchlist')
      return new Response(
        JSON.stringify({ message: 'No TV shows to monitor' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get unique show IDs
    const uniqueShowIds = [...new Set(watchlistShows.map((item: any) => item.tmdb_id))]
    console.log(`Monitoring ${uniqueShowIds.length} unique shows`)

    // Get existing episode cache
    const { data: existingCache } = await supabaseClient
      .from('episode_cache')
      .select('*')
      .in('show_id', uniqueShowIds)

    const cacheMap = new Map<number, EpisodeCache>()
    existingCache?.forEach((item: any) => {
      cacheMap.set(item.show_id, item)
    })

    const newEpisodes: NewEpisode[] = []
    const cacheUpdates: EpisodeCache[] = []
    const now = new Date().toISOString()

    // Check each show for new episodes
    for (const showId of uniqueShowIds) {
      try {
        const cachedData = cacheMap.get(Number(showId))
        
        // Skip if checked recently (within 6 hours)
        if (cachedData) {
          const lastChecked = new Date(cachedData.last_checked)
          const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
          if (lastChecked > sixHoursAgo) {
            console.log(`Skipping show ${showId} - checked recently`)
            continue
          }
        }

        // Fetch show details from TMDB
        const showResponse = await fetch(
          `https://api.themoviedb.org/3/tv/${showId}?api_key=${tmdbApiKey}`
        )

        if (!showResponse.ok) {
          console.error(`Failed to fetch show ${showId}: ${showResponse.status}`)
          continue
        }

        const showDetails = await showResponse.json()
        
        // Find the latest aired episode
        const latestEpisode = await findLatestAiredEpisode(Number(showId), showDetails, tmdbApiKey)
        
        if (!latestEpisode) {
          console.log(`No aired episodes found for show ${showId}`)
          continue
        }

        // Check if this is a new episode
        if (cachedData) {
          const isNewer = (
            latestEpisode.season_number > cachedData.latest_season ||
            (latestEpisode.season_number === cachedData.latest_season && 
             latestEpisode.episode_number > cachedData.latest_episode)
          )
          
          if (isNewer) {
            // Get episodes between cached and latest
            const episodesBetween = await getEpisodesBetween(
              Number(showId),
              showDetails,
              {
                seasonNumber: cachedData.latest_season,
                episodeNumber: cachedData.latest_episode
              },
              latestEpisode,
              tmdbApiKey
            )
            
            newEpisodes.push(...episodesBetween)
          }
        }

        // Update cache
        cacheUpdates.push({
          show_id: Number(showId),
          last_checked: now,
          latest_season: latestEpisode.season_number,
          latest_episode: latestEpisode.episode_number,
          latest_air_date: latestEpisode.air_date
        })

        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`Error checking show ${showId}:`, (error as Error).message)
      }
    }

    // Update episode cache
    if (cacheUpdates.length > 0) {
      const { error: cacheError } = await supabaseClient
        .from('episode_cache')
        .upsert(cacheUpdates, { onConflict: 'show_id' })

      if (cacheError) {
        console.error('Failed to update episode cache:', cacheError)
      } else {
        console.log(`Updated cache for ${cacheUpdates.length} shows`)
      }
    }

    // Send notifications for new episodes
    if (newEpisodes.length > 0) {
      console.log(`Found ${newEpisodes.length} new episodes`)
      await sendEpisodeNotifications(newEpisodes, watchlistShows, supabaseClient)
    }

    return new Response(
      JSON.stringify({
        message: 'Episode monitoring completed',
        showsChecked: uniqueShowIds.length,
        newEpisodes: newEpisodes.length,
        cacheUpdates: cacheUpdates.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Episode monitoring error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function findLatestAiredEpisode(showId: number, showDetails: any, apiKey: string) {
  const today = new Date()
  let latestEpisode = null

  // Check seasons in reverse order
  const seasons = showDetails.seasons
    ?.filter((s: any) => s.season_number > 0)
    ?.sort((a: any, b: any) => b.season_number - a.season_number) || []

  for (const season of seasons) {
    try {
      const seasonResponse = await fetch(
        `https://api.themoviedb.org/3/tv/${showId}/season/${season.season_number}?api_key=${apiKey}`
      )

      if (!seasonResponse.ok) continue

      const seasonDetails = await seasonResponse.json()
      const episodes = seasonDetails.episodes || []

      // Find aired episodes in this season
      const airedEpisodes = episodes.filter((ep: any) => {
        if (!ep.air_date) return false
        const airDate = new Date(ep.air_date)
        return airDate <= today
      })

      if (airedEpisodes.length > 0) {
        const seasonLatest = airedEpisodes.reduce((prev: any, current: any) =>
          current.episode_number > prev.episode_number ? current : prev
        )

        if (!latestEpisode || 
            seasonLatest.season_number > latestEpisode.season_number ||
            (seasonLatest.season_number === latestEpisode.season_number && 
             seasonLatest.episode_number > latestEpisode.episode_number)) {
          latestEpisode = seasonLatest
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } catch (error) {
      console.error(`Error fetching season ${season.season_number}:`, error)
    }
  }

  return latestEpisode
}

async function getEpisodesBetween(
  showId: number,
  showDetails: any,
  startEpisode: { seasonNumber: number; episodeNumber: number },
  endEpisode: any,
  apiKey: string
): Promise<NewEpisode[]> {
  const episodes: NewEpisode[] = []
  const today = new Date()

  if (startEpisode.seasonNumber === endEpisode.season_number) {
    // Same season
    try {
      const seasonResponse = await fetch(
        `https://api.themoviedb.org/3/tv/${showId}/season/${startEpisode.seasonNumber}?api_key=${apiKey}`
      )

      if (seasonResponse.ok) {
        const seasonDetails = await seasonResponse.json()
        const newEpisodes = seasonDetails.episodes?.filter((ep: any) => {
          const isNewer = ep.episode_number > startEpisode.episodeNumber && 
                         ep.episode_number <= endEpisode.episode_number
          const hasAired = ep.air_date && new Date(ep.air_date) <= today
          return isNewer && hasAired
        }) || []

        episodes.push(...newEpisodes.map((ep: any) => ({
          showId,
          showName: showDetails.name,
          seasonNumber: ep.season_number,
          episodeNumber: ep.episode_number,
          episodeName: ep.name,
          airDate: ep.air_date,
          overview: ep.overview || '',
          stillPath: ep.still_path
        })))
      }
    } catch (error) {
      console.error(`Error fetching episodes for season ${startEpisode.seasonNumber}:`, error)
    }
  } else {
    // Multiple seasons
    for (let seasonNum = startEpisode.seasonNumber; seasonNum <= endEpisode.season_number; seasonNum++) {
      try {
        const seasonResponse = await fetch(
          `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNum}?api_key=${apiKey}`
        )

        if (!seasonResponse.ok) continue

        const seasonDetails = await seasonResponse.json()
        const seasonEpisodes = seasonDetails.episodes?.filter((ep: any) => {
          const hasAired = ep.air_date && new Date(ep.air_date) <= today
          if (!hasAired) return false

          if (seasonNum === startEpisode.seasonNumber) {
            return ep.episode_number > startEpisode.episodeNumber
          } else if (seasonNum === endEpisode.season_number) {
            return ep.episode_number <= endEpisode.episode_number
          } else {
            return true
          }
        }) || []

        episodes.push(...seasonEpisodes.map((ep: any) => ({
          showId,
          showName: showDetails.name,
          seasonNumber: ep.season_number,
          episodeNumber: ep.episode_number,
          episodeName: ep.name,
          airDate: ep.air_date,
          overview: ep.overview || '',
          stillPath: ep.still_path
        })))

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`Error fetching season ${seasonNum}:`, error)
      }
    }
  }

  return episodes
}

async function sendEpisodeNotifications(
  newEpisodes: NewEpisode[],
  watchlistShows: any[],
  supabaseClient: any
) {
  try {
    // Group episodes by show and user
    const notificationGroups = new Map<string, { userId: string; episodes: NewEpisode[] }>()

    for (const episode of newEpisodes) {
      const usersWithShow = watchlistShows.filter(item => item.tmdb_id === episode.showId)
      
      for (const userShow of usersWithShow) {
        const key = `${userShow.user_id}_${episode.showId}`
        
        if (!notificationGroups.has(key)) {
          notificationGroups.set(key, {
            userId: userShow.user_id,
            episodes: []
          })
        }
        
        notificationGroups.get(key)!.episodes.push(episode)
      }
    }

    // Get user notification preferences
    const userIds = [...new Set(Array.from(notificationGroups.values()).map(g => g.userId))]
    const { data: userPrefs } = await supabaseClient
      .from('notification_preferences')
      .select('user_id, episode_releases, quiet_hours_enabled, quiet_hours_start, quiet_hours_end')
      .in('user_id', userIds)

    const prefsMap = new Map<string, UserNotificationPrefs>()
    userPrefs?.forEach((pref: UserNotificationPrefs) => {
      prefsMap.set(pref.user_id, pref)
    })

    // Create notifications
    const notifications = []
    const now = new Date()

    for (const [, group] of notificationGroups) {
      const userPrefs = prefsMap.get(group.userId)
      
      // Skip if user has disabled episode notifications
      if (userPrefs && !userPrefs.episode_releases) {
        continue
      }

      // Check quiet hours
      let scheduledFor = now.toISOString()
      if (userPrefs?.quiet_hours_enabled) {
        scheduledFor = calculateScheduleTime(now, userPrefs.quiet_hours_start, userPrefs.quiet_hours_end)
      }

      // Group episodes by show
      const episodesByShow = new Map<number, NewEpisode[]>()
      for (const episode of group.episodes) {
        if (!episodesByShow.has(episode.showId)) {
          episodesByShow.set(episode.showId, [])
        }
        episodesByShow.get(episode.showId)!.push(episode)
      }

      // Create one notification per show
      for (const [, episodes] of episodesByShow) {
        const sortedEpisodes = episodes.sort((a, b) => {
          if (a.seasonNumber !== b.seasonNumber) {
            return a.seasonNumber - b.seasonNumber
          }
          return a.episodeNumber - b.episodeNumber
        })

        const firstEpisode = sortedEpisodes[0]
        let title: string
        let body: string

        if (episodes.length === 1) {
          title = `New Episode: ${firstEpisode.showName}`
          body = `S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber}: ${firstEpisode.episodeName}`
        } else {
          title = `${episodes.length} New Episodes: ${firstEpisode.showName}`
          const lastEpisode = sortedEpisodes[sortedEpisodes.length - 1]
          body = `S${firstEpisode.seasonNumber}E${firstEpisode.episodeNumber} - S${lastEpisode.seasonNumber}E${lastEpisode.episodeNumber}`
        }

        notifications.push({
          user_id: group.userId,
          type: 'episode_release',
          title,
          body,
          data: {
            showId: firstEpisode.showId,
            showName: firstEpisode.showName,
            episodes: episodes.map(ep => ({
              season: ep.seasonNumber,
              episode: ep.episodeNumber,
              name: ep.episodeName,
              airDate: ep.airDate
            }))
          },
          scheduled_for: scheduledFor,
          priority: 'normal',
          created_at: now.toISOString()
        })
      }
    }

    // Insert notifications
    if (notifications.length > 0) {
      const { error: notificationError } = await supabaseClient
        .from('notifications')
        .insert(notifications)

      if (notificationError) {
        console.error('Failed to create notifications:', notificationError)
      } else {
        console.log(`Created ${notifications.length} episode notifications`)
      }
    }

  } catch (error) {
    console.error('Error sending episode notifications:', error)
  }
}

function calculateScheduleTime(now: Date, quietStart: string, quietEnd: string): string {
  const [startHour, startMin] = quietStart.split(':').map(Number)
  const [endHour, endMin] = quietEnd.split(':').map(Number)
  
  const currentHour = now.getHours()
  const currentMin = now.getMinutes()
  const currentTime = currentHour * 60 + currentMin
  const quietStartTime = startHour * 60 + startMin
  const quietEndTime = endHour * 60 + endMin
  
  // Handle quiet hours that span midnight
  const isInQuietHours = quietStartTime > quietEndTime
    ? (currentTime >= quietStartTime || currentTime < quietEndTime)
    : (currentTime >= quietStartTime && currentTime < quietEndTime)
  
  if (!isInQuietHours) {
    return now.toISOString()
  }
  
  // Schedule for end of quiet hours
  const scheduleDate = new Date(now)
  scheduleDate.setHours(endHour, endMin, 0, 0)
  
  // If end time is tomorrow (quiet hours span midnight)
  if (quietStartTime > quietEndTime && currentTime >= quietStartTime) {
    scheduleDate.setDate(scheduleDate.getDate() + 1)
  }
  
  return scheduleDate.toISOString()
}