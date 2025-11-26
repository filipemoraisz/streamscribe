import { WatchlistItem } from '../types';
import { tmdbService } from './tmdb';

export interface SubscriptionAction {
    month: string;
    year: number;
    action: 'START' | 'KEEP' | 'CANCEL' | 'SWITCH';
    provider: {
        id: string;
        name: string;
        logoUrl?: string;
        cost: number;
    };
    previousProvider?: {
        id: string;
        name: string;
    };
    contentToWatch: WatchlistItem[];
    savings: number;
    reasoning: string;
}

export interface OptimizationPlan {
    currentMonth: SubscriptionAction;
    upcomingMonths: SubscriptionAction[];
    totalAnnualSavings: number;
    totalWatchTimeHours: number;
    averageEfficiency: number; // $/hour
    currentStreak: number; // months
}

class OptimizerService {
    // Default to 20 hours of watch time per month if not specified
    private readonly DEFAULT_MONTHLY_WATCH_HOURS = 20;

    // Average runtime assumptions
    private readonly AVG_MOVIE_RUNTIME_MINS = 120;
    private readonly AVG_EPISODE_RUNTIME_MINS = 45;

    async generateOptimizationPlan(watchlist: WatchlistItem[]): Promise<OptimizationPlan> {
        const unwatchedItems = watchlist.filter(item => !item.watched);

        if (unwatchedItems.length === 0) {
            return this.getEmptyPlan();
        }

        // 1. Cluster items by provider
        const providerClusters = await this.clusterByProvider(unwatchedItems);

        // 2. Calculate density (hours of content) for each cluster
        const rankedClusters = this.rankClustersByDensity(providerClusters);

        // 3. Generate Schedule
        return this.generateSchedule(rankedClusters);
    }

    private async clusterByProvider(items: WatchlistItem[]) {
        const clusters = new Map<string, {
            provider: { id: string; name: string; logoUrl?: string };
            items: WatchlistItem[];
            totalRuntimeMins: number;
        }>();

        for (const item of items) {
            // Use cached provider data if available, otherwise fetch (in real app, ensure cache is populated)
            // For now, we'll assume the item has provider info or we'd fetch it. 
            // To keep this sync-ish for the prototype, we rely on what's available or fetch lightly.
            // In a robust implementation, we'd batch fetch provider data.

            let providers = item.providerCache?.data;
            if (!providers) {
                try {
                    providers = await tmdbService.getWatchProviders(item.id, item.type);
                } catch (e) {
                    console.warn(`Could not fetch providers for ${item.title}`);
                    continue;
                }
            }

            if (!providers) continue;

            const flatrate = providers.filter(p => p.type === 'flatrate');

            for (const p of flatrate) {
                if (!clusters.has(p.service.id)) {
                    clusters.set(p.service.id, {
                        provider: {
                            id: p.service.id,
                            name: p.service.name,
                            logoUrl: p.service.imageSet?.darkThemeImage
                        },
                        items: [],
                        totalRuntimeMins: 0
                    });
                }

                const cluster = clusters.get(p.service.id)!;
                cluster.items.push(item);

                // Estimate runtime
                const runtime = item.type === 'movie'
                    ? this.AVG_MOVIE_RUNTIME_MINS
                    : this.AVG_EPISODE_RUNTIME_MINS * 10; // Assume 1 season ~ 10 eps

                cluster.totalRuntimeMins += runtime;
            }
        }

        return clusters;
    }

    private rankClustersByDensity(clusters: Map<string, any>) {
        return Array.from(clusters.values()).sort((a, b) => b.totalRuntimeMins - a.totalRuntimeMins);
    }

    private generateSchedule(rankedClusters: any[]): OptimizationPlan {
        const today = new Date();
        let currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);

        const schedule: SubscriptionAction[] = [];
        let totalSavings = 0;
        let totalHours = 0;

        // Simple Greedy Algorithm:
        // 1. Pick the highest density provider for Month 1.
        // 2. Remove those items from consideration (or mark as "scheduled").
        // 3. Pick the next highest for Month 2, etc.
        // Note: This is a simplification. Real logic would handle overlapping content better.

        const scheduledItemIds = new Set<string>();

        for (const cluster of rankedClusters) {
            // Filter out items already scheduled by a previous (better) provider
            const uniqueItems = cluster.items.filter((i: WatchlistItem) => !scheduledItemIds.has(`${i.type}-${i.id}`));

            if (uniqueItems.length === 0) continue;

            // Calculate how many months this provider is needed for
            const totalClusterHours = cluster.totalRuntimeMins / 60;
            const monthsNeeded = Math.ceil(totalClusterHours / this.DEFAULT_MONTHLY_WATCH_HOURS);

            // For this MVP, we'll just assign it to the next available slot(s)
            // In reality, we might split it across months.

            const monthName = currentMonthDate.toLocaleString('default', { month: 'long' });
            const year = currentMonthDate.getFullYear();

            // Mock cost - in real app, fetch from DB
            const cost = 14.99;
            const value = uniqueItems.length * 3.99; // Rental comparison
            const savings = Math.max(0, value - cost);

            schedule.push({
                month: monthName,
                year: year,
                action: schedule.length === 0 ? 'START' : 'SWITCH',
                provider: {
                    id: cluster.provider.id,
                    name: cluster.provider.name,
                    logoUrl: cluster.provider.logoUrl,
                    cost: cost
                },
                previousProvider: schedule.length > 0 ? schedule[schedule.length - 1].provider : undefined,
                contentToWatch: uniqueItems,
                savings: savings,
                reasoning: `Watch ${uniqueItems.length} items exclusively on ${cluster.provider.name}`
            });

            // Mark items as scheduled
            uniqueItems.forEach((i: WatchlistItem) => scheduledItemIds.add(`${i.type}-${i.id}`));

            totalSavings += savings;
            totalHours += totalClusterHours;

        }

        if (schedule.length === 0) return this.getEmptyPlan();

        const [currentMonth, ...upcomingMonths] = schedule;
        const averageEfficiency = totalHours > 0 ? totalSavings / totalHours : 0;

        return {
            currentMonth,
            upcomingMonths,
            totalAnnualSavings: totalSavings,
            totalWatchTimeHours: totalHours,
            averageEfficiency,
            currentStreak: schedule.length // Mock streak for now
        };
    }

    private getEmptyPlan(): OptimizationPlan {
        return {
            currentMonth: {
                month: '',
                year: 0,
                action: 'KEEP',
                provider: { id: '', name: '', cost: 0 },
                contentToWatch: [],
                savings: 0,
                reasoning: 'No content to optimize'
            },
            upcomingMonths: [],
            totalAnnualSavings: 0,
            totalWatchTimeHours: 0,
            averageEfficiency: 0,
            currentStreak: 0
        };
    }
}

export const optimizerService = new OptimizerService();
