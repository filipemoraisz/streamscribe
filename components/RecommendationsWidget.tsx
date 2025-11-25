import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { MonthlyRecommendation, ProviderRecommendation, recommendationService, WatchlistItem } from '../services';
import { ProviderDetailsModal } from './ProviderDetailsModal';

export const RecommendationsWidget = () => {
    const { user } = useAuth();
    const [recommendations, setRecommendations] = useState<MonthlyRecommendation | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedProvider, setSelectedProvider] = useState<ProviderRecommendation | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const loadRecommendations = useCallback(async () => {
        try {
            const monthlyRecs = await recommendationService.generateMonthlyRecommendations();
            setRecommendations(monthlyRecs);
        } catch (error) {
            console.error('Error loading recommendations:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user) {
            loadRecommendations();
        }
    }, [user, loadRecommendations]);

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

    const handleViewAll = () => {
        router.push('/recommendations');
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="small" color={Colors.primary} />
            </View>
        );
    }

    if (!recommendations || recommendations.totalWatchlistItems === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyCard}>
                    <Ionicons name="bulb-outline" size={20} color={Colors.textMuted} />
                    <Text style={styles.emptyText}>
                        Add to watchlist for picks.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Top Picks</Text>
                <TouchableOpacity onPress={handleViewAll} style={styles.viewAllButton}>
                    <Text style={styles.viewAllText}>View All</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.list}>
                {recommendations.topProviders.slice(0, 3).map((recommendation, index) => (
                    <TouchableOpacity
                        key={recommendation.providerId}
                        style={styles.item}
                        onPress={() => handleProviderPress(recommendation.providerId)}
                    >
                        <View style={styles.rankBadge}>
                            <Text style={styles.rankText}>{index + 1}</Text>
                        </View>

                        {recommendation.logoUrl ? (
                            <Image
                                source={{ uri: recommendation.logoUrl }}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                        ) : (
                            <View style={styles.placeholderLogo}>
                                <Text style={styles.placeholderText}>
                                    {recommendation.providerName.charAt(0)}
                                </Text>
                            </View>
                        )}

                        <Text style={styles.providerName} numberOfLines={1}>
                            {recommendation.providerName}
                        </Text>
                        <Text style={styles.price}>
                            ${Math.round(recommendation.totalCost)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ProviderDetailsModal
                visible={modalVisible}
                recommendation={selectedProvider}
                onClose={() => setModalVisible(false)}
                onItemPress={handleItemPress}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    viewAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    viewAllText: {
        fontSize: 12,
        color: Colors.primary,
        fontWeight: '600',
    },
    list: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    item: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: Colors.surface,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        position: 'relative',
    },
    rankBadge: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: Colors.primary,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    rankText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    logo: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginBottom: 8,
    },
    placeholderLogo: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    placeholderText: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    providerName: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 2,
        textAlign: 'center',
    },
    price: {
        fontSize: 11,
        color: Colors.textMuted,
    },
    emptyCard: {
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    emptyText: {
        flex: 1,
        fontSize: 12,
        color: Colors.textSecondary,
    },
});
