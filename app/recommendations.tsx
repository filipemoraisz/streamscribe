import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProviderDetailsModal } from '../components/ProviderDetailsModal';
import { RecommendationCard } from '../components/RecommendationCard';
import { Colors } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { MonthlyRecommendation, ProviderRecommendation, recommendationService, WatchlistItem } from '../services';
import { optimizerService } from '../services/optimizer';
import { storageService } from '../services/storage';

export default function RecommendationsScreen() {
    const { user } = useAuth();
    const [recommendations, setRecommendations] = useState<MonthlyRecommendation | null>(null);
    const [totalSavings, setTotalSavings] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<ProviderRecommendation | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const loadRecommendations = useCallback(async (force = false) => {
        try {
            const [monthlyRecs, watchlist] = await Promise.all([
                recommendationService.generateMonthlyRecommendations(force),
                storageService.getWatchlist()
            ]);
            
            // Get optimizer savings (same as home screen)
            const optimizationPlan = await optimizerService.generateOptimizationPlan(watchlist);
            
            setRecommendations(monthlyRecs);
            setTotalSavings(optimizationPlan.totalAnnualSavings);
        } catch (error) {
            console.error('Error loading recommendations:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (user) {
            loadRecommendations(false);
        }
    }, [user, loadRecommendations]);

    const onRefresh = () => {
        setRefreshing(true);
        loadRecommendations(true);
    };

    const handleProviderPress = (providerId: string) => {
        const provider = recommendations?.topProviders.find(p => p.providerId === providerId);
        if (provider) {
            setSelectedProvider(provider);
            setModalVisible(true);
        }
    };

    const handleItemPress = (item: WatchlistItem) => {
        setModalVisible(false);
        router.push(`/details/${item.type}/${item.id}`);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen options={{ title: 'Recommendations', headerBackTitle: 'Back' }} />
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (!recommendations || recommendations.totalWatchlistItems === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen options={{ title: 'Recommendations', headerBackTitle: 'Back' }} />
                <View style={styles.centerContainer}>
                    <View style={styles.emptyCard}>
                        <Ionicons name="bulb-outline" size={48} color={Colors.textMuted} />
                        <Text style={styles.emptyText}>
                            Add items to your watchlist to get streaming recommendations.
                        </Text>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ title: 'Recommendations', headerBackTitle: 'Back' }} />
            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                }
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Best Value for You</Text>
                    <Text style={styles.subtitle}>{recommendations.month} {recommendations.year}</Text>
                </View>

                {/* Summary Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{Math.round(recommendations.coveragePercentage)}%</Text>
                        <Text style={styles.statLabel}>Coverage</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            ${totalSavings >= 1000 
                                ? `${Math.round(totalSavings / 1000)}k` 
                                : Math.round(totalSavings)}
                        </Text>
                        <Text style={styles.statLabel}>Total Savings</Text>
                    </View>
                </View>

                {/* Top Recommendations */}
                <View style={styles.list}>
                    {recommendations.topProviders.map((recommendation, index) => (
                        <RecommendationCard
                            key={recommendation.providerId}
                            recommendation={recommendation}
                            rank={index + 1}
                            onPress={() => handleProviderPress(recommendation.providerId)}
                        />
                    ))}
                </View>
            </ScrollView>

            <ProviderDetailsModal
                visible={modalVisible}
                recommendation={selectedProvider}
                onClose={() => setModalVisible(false)}
                onItemPress={handleItemPress}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        padding: 20,
        paddingBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textMuted,
        marginTop: 4,
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        marginHorizontal: 20,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    divider: {
        width: 1,
        backgroundColor: Colors.border,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    statLabel: {
        fontSize: 14,
        color: Colors.textMuted,
        marginTop: 4,
    },
    list: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    emptyCard: {
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 24,
    },
});
