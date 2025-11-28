import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MediaCard } from '../components/MediaCard';
import { Colors } from '../constants/Colors';
import { progressService } from '../services/progress';
import { storageService } from '../services/storage';
import { ShowProgress, WatchlistItem } from '../types';

const { width } = Dimensions.get('window');
const numColumns = 3;
const GAP = 12;
const PADDING = 16;
const itemWidth = (width - (PADDING * 2) - (GAP * (numColumns - 1))) / numColumns;

export default function HistoryScreen() {
    const [historyItems, setHistoryItems] = useState<{
        upToDate: WatchlistItem[];
        completed: WatchlistItem[];
    }>({ upToDate: [], completed: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const [watchlist, allProgress] = await Promise.all([
                storageService.getWatchlist(),
                progressService.getAllShowsProgress(),
            ]);

            const progressMap = new Map(allProgress.map(p => [p.show_id, p]));

            const upToDate: WatchlistItem[] = [];
            const completed: WatchlistItem[] = [];

            watchlist.forEach(item => {
                const progress = progressMap.get(item.id);

                // Logic for categorization
                if (item.type === 'movie') {
                    if (item.watched) {
                        completed.push(item);
                    }
                } else {
                    // TV Shows
                    if (progress?.status === 'up_to_date') {
                        upToDate.push(item);
                    } else if (progress?.status === 'completed') {
                        completed.push(item);
                    }
                }
            });

            // Sort by last watched (using added_date as proxy if last_watched not available in WatchlistItem, 
            // ideally we should merge progress data to get last_watched_date)
            const sortByDate = (a: WatchlistItem, b: WatchlistItem) =>
                new Date(b.added_date).getTime() - new Date(a.added_date).getTime();

            setHistoryItems({
                upToDate: upToDate.sort(sortByDate),
                completed: completed.sort(sortByDate),
            });

        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleItemPress = (item: WatchlistItem) => {
        router.push(`/details/${item.type}/${item.id}`);
    };

    const renderItem = ({ item }: { item: WatchlistItem }) => {
        const mediaItem = {
            id: item.id,
            title: item.title,
            name: item.title,
            poster_path: item.poster_path,
            release_date: item.release_date || '',
            first_air_date: item.first_air_date || '',
            vote_average: item.vote_average,
            overview: '',
            backdrop_path: null,
            vote_count: 0,
            genre_ids: [],
            adult: false,
            original_language: '',
            original_title: item.title,
            original_name: item.title,
            popularity: 0,
            video: false,
            origin_country: [],
        };

        return (
            <View style={[styles.cardContainer, { width: itemWidth }]}>
                <MediaCard
                    item={mediaItem}
                    type={item.type}
                    onPress={() => handleItemPress(item)}
                    style={{ width: '100%', height: itemWidth * 1.5 }}
                />
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>History</Text>
            </View>

            <FlatList
                contentContainerStyle={styles.listContent}
                data={[]} // We use ListHeaderComponent for sections to allow scrolling the whole page
                renderItem={null}
                ListHeaderComponent={
                    <View>
                        {/* Section 1: Waiting for New Episodes */}
                        {historyItems.upToDate.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="hourglass-outline" size={20} color={Colors.primary} />
                                    <Text style={styles.sectionTitle}>Waiting for New Episodes</Text>
                                </View>
                                <FlatList
                                    data={historyItems.upToDate}
                                    renderItem={renderItem}
                                    keyExtractor={item => `${item.type}-${item.id}`}
                                    numColumns={numColumns}
                                    columnWrapperStyle={{ gap: GAP }}
                                    scrollEnabled={false} // Nested in main list
                                />
                            </View>
                        )}

                        {/* Section 2: Completed Stories */}
                        {historyItems.completed.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
                                    <Text style={styles.sectionTitle}>Completed Stories</Text>
                                </View>
                                <FlatList
                                    data={historyItems.completed}
                                    renderItem={renderItem}
                                    keyExtractor={item => `${item.type}-${item.id}`}
                                    numColumns={numColumns}
                                    columnWrapperStyle={{ gap: GAP }}
                                    scrollEnabled={false} // Nested in main list
                                />
                            </View>
                        )}

                        {historyItems.upToDate.length === 0 && historyItems.completed.length === 0 && (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No history yet.</Text>
                            </View>
                        )}
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backButton: {
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
    },
    listContent: {
        padding: 16,
    },
    section: {
        marginBottom: 32,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
    },
    cardContainer: {
        marginBottom: 16,
    },
    emptyState: {
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.textSecondary,
        fontSize: 16,
    }
});
