/// <reference path="../types.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StreamingAvailabilityChange {
    id: string;
    tmdbId: number;
    mediaType: 'movie' | 'tv';
    title: string;
    changeType: 'added' | 'removed' | 'leaving_soon';
    service: {
        id: string;
        name: string;
    };
    previousAvailability: any[];
    currentAvailability: any[];
    detectedAt: string;
    leavingDate?: string;
}

serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const tmdbApiKey = Deno.env.get('TMDB_API_KEY')
        if (!tmdbApiKey) {
            throw new Error('TMDB_API_KEY not configured')
        }

        console.log('Starting streaming availability monitoring job...')

        // Get all unique watchlist items across all users
        const { data: watchlistItems, error: watchlistError } = await supabaseClient
            .from('watchlists')
            .select('tmdb_id, media_type, user_id')
            .in('status', ['plan_to_watch', 'watching'])

        if (watchlistError) {
            throw new Error(`Failed to fetch watchlist: ${watchlistError.message}`)
        }

        console.log(`Found ${watchlistItems?.length || 0} watchlist items to monitor`)

        // Group by tmdb_id and media_type to avoid duplicate API calls
        const uniqueItems = new Map<string, { tmdbId: number; mediaType: string; userIds: string[] }>()

        watchlistItems?.forEach((item: any) => {
            const key = `${item.tmdb_id}-${item.media_type}`
            if (uniqueItems.has(key)) {
                uniqueItems.get(key)!.userIds.push(item.user_id)
            } else {
                uniqueItems.set(key, {
                    tmdbId: item.tmdb_id,
                    mediaType: item.media_type,
                    userIds: [item.user_id]
                })
            }
        })

        console.log(`Processing ${uniqueItems.size} unique items`)

        const changes: StreamingAvailabilityChange[] = []
        let processedCount = 0

        // Process items in batches to respect rate limits
        const batchSize = 10
        const uniqueItemsArray = Array.from(uniqueItems.values())

        for (let i = 0; i < uniqueItemsArray.length; i += batchSize) {
            const batch = uniqueItemsArray.slice(i, i + batchSize)

            const batchPromises = batch.map(async (item: any) => {
                try {
                    return await checkItemAvailability(supabaseClient, tmdbApiKey, item.tmdbId, item.mediaType)
                } catch (error) {
                    console.error(`Error checking item ${item.tmdbId}:`, error)
                    return null
                }
            })

            const batchResults = await Promise.all(batchPromises)
            const validResults = batchResults.filter(result => result !== null) as StreamingAvailabilityChange[]
            changes.push(...validResults)

            processedCount += batch.length
            console.log(`Processed ${processedCount}/${uniqueItemsArray.length} items`)

            // Add delay between batches to respect rate limits
            if (i + batchSize < uniqueItemsArray.length) {
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }

        console.log(`Found ${changes.length} availability changes`)

        // Store changes for notification processing
        if (changes.length > 0) {
            const { error: insertError } = await supabaseClient
                .from('streaming_availability_changes')
                .insert(changes.map(change => ({
                    tmdb_id: change.tmdbId,
                    media_type: change.mediaType,
                    title: change.title,
                    change_type: change.changeType,
                    service_id: change.service.id,
                    service_name: change.service.name,
                    previous_availability: change.previousAvailability,
                    current_availability: change.currentAvailability,
                    detected_at: change.detectedAt,
                    leaving_date: change.leavingDate,
                    processed: false
                })))

            if (insertError) {
                console.error('Error storing changes:', insertError)
            } else {
                console.log(`Stored ${changes.length} changes for notification processing`)
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                itemsProcessed: processedCount,
                changesDetected: changes.length,
                timestamp: new Date().toISOString()
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        )

    } catch (error) {
        console.error('Error in streaming availability monitor:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: (error as Error).message,
                timestamp: new Date().toISOString()
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            },
        )
    }
})

async function checkItemAvailability(
    supabaseClient: any,
    tmdbApiKey: string,
    tmdbId: number,
    mediaType: string
): Promise<StreamingAvailabilityChange | null> {
    try {
        // Check cache first
        const { data: cachedData } = await supabaseClient
            .from('media_cache')
            .select('availability_data, last_updated')
            .eq('tmdb_id', tmdbId)
            .eq('media_type', mediaType)
            .single()

        const cacheAge = cachedData ? Date.now() - new Date(cachedData.last_updated).getTime() : Infinity
        const cacheExpired = cacheAge > (6 * 60 * 60 * 1000) // 6 hours

        if (!cacheExpired && cachedData?.availability_data) {
            // Cache is still valid, no need to check
            return null
        }

        // Fetch current availability from TMDB
        const watchProvidersUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers?api_key=${tmdbApiKey}`
        const response = await fetch(watchProvidersUrl)

        if (!response.ok) {
            throw new Error(`TMDB API error: ${response.status}`)
        }

        const data = await response.json()
        const currentAvailability = data.results || {}

        // Get previous availability for comparison
        const previousAvailability = cachedData?.availability_data || {}

        // Detect changes (simplified - focusing on US market)
        const change = detectAvailabilityChange(tmdbId, mediaType, previousAvailability, currentAvailability)

        // Update cache
        await supabaseClient.from('media_cache').upsert({
            tmdb_id: tmdbId,
            media_type: mediaType,
            availability_data: currentAvailability,
            last_updated: new Date().toISOString()
        }, { onConflict: 'tmdb_id, media_type' })

        return change

    } catch (error) {
        console.error(`Error checking availability for ${mediaType} ${tmdbId}:`, error)
        return null
    }
}

function detectAvailabilityChange(
    tmdbId: number,
    mediaType: string,
    previousAvailability: any,
    currentAvailability: any
): StreamingAvailabilityChange | null {
    try {
        // Focus on US market
        const previousUS = previousAvailability.US || {}
        const currentUS = currentAvailability.US || {}

        // Get flatrate services (subscriptions)
        const previousServices = new Set((previousUS.flatrate || []).map((p: any) => p.provider_id.toString()))
        const currentServices = new Set((currentUS.flatrate || []).map((p: any) => p.provider_id.toString()))

        // Check for newly added services
        const addedServices = [...currentServices].filter(id => !previousServices.has(id))
        if (addedServices.length > 0) {
            const addedProvider = (currentUS.flatrate || []).find((p: any) => addedServices.includes(p.provider_id.toString()))
            if (addedProvider) {
                return {
                    id: `${tmdbId}-${mediaType}-${addedProvider.provider_id}-added-${Date.now()}`,
                    tmdbId,
                    mediaType: mediaType as 'movie' | 'tv',
                    title: `${mediaType} ${tmdbId}`, // Will be enriched with actual title later
                    changeType: 'added',
                    service: {
                        id: addedProvider.provider_id.toString(),
                        name: addedProvider.provider_name,
                    },
                    previousAvailability: previousUS.flatrate || [],
                    currentAvailability: currentUS.flatrate || [],
                    detectedAt: new Date().toISOString(),
                }
            }
        }

        // Check for removed services
        const removedServices = [...previousServices].filter(id => !currentServices.has(id))
        if (removedServices.length > 0) {
            const removedProvider = (previousUS.flatrate || []).find((p: any) => removedServices.includes(p.provider_id.toString()))
            if (removedProvider) {
                return {
                    id: `${tmdbId}-${mediaType}-${removedProvider.provider_id}-removed-${Date.now()}`,
                    tmdbId,
                    mediaType: mediaType as 'movie' | 'tv',
                    title: `${mediaType} ${tmdbId}`, // Will be enriched with actual title later
                    changeType: 'removed',
                    service: {
                        id: removedProvider.provider_id.toString(),
                        name: removedProvider.provider_name,
                    },
                    previousAvailability: previousUS.flatrate || [],
                    currentAvailability: currentUS.flatrate || [],
                    detectedAt: new Date().toISOString(),
                }
            }
        }

        return null
    } catch (error) {
        console.error('Error detecting availability change:', error)
        return null
    }
}