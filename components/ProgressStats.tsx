import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { progressService } from '../services/progress';
import { tmdbService } from '../services/tmdb';
import { ShowProgress, TVShowDetails } from '../types';

interface ShowWithProgress extends ShowProgress {
    showDetails?: TVShowDetails;
}

export const ProgressStats = () => {
    const { user } = useAuth();
    const [showsProgress, setShowsProgress] = useState<ShowWithProgress[]>([]);
    const [loading, setLoading] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            if (user) {
                loadProgress();
            }
        }, [user])
    );

    const loadProgress = async () => {
        try {
            setLoading(true);
            const progress = await progressService.getAllShowsProgress();

            // Load show details for each progress item
            const progressWithDetails = await Promise.all(
                progress.map(async (prog) => {
                    try {
                        const showDetails = await tmdbService.getTVShowDetails(prog.show_id);
                        return { ...prog, showDetails };
                    } catch (error) {
                        console.error(`Error loading details for show ${prog.show_id}:`, error);
                        return prog;
                    }
                })
            );

            // Sort by last watched date
            progressWithDetails.sort((a, b) =>
                new Date(b.last_watched_date).getTime() - new Date(a.last_watched_date).getTime()
            );

            setShowsProgress(progressWithDetails);
        } catch (error) {
            console.error('Error loading progress:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleShowPress = (showProgress: ShowWithProgress) => {
        router.push(`/details/tv/${showProgress.show_id}`);
    };

    if (!user || (showsProgress.length === 0 && !loading)) {
        return null;
    }

    const watchingShows = showsProgress.filter(s => s.status === 'watching');
    const completedShows = showsProgress.filter(s => s.status === 'completed');

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Viewing Progress</Text>
                <View style={styles.statsContainer}>
                    <View style={styles.statBadge}>
                        <Text style={styles.statValue}>{watchingShows.length}</Text>
                        <Text style={styles.statLabel}>Watching</Text>
                    </View>
                    <View style={[styles.statBadge, styles.completedBadge]}>
                        <Text style={[styles.statValue, styles.completedText]}>{completedShows.length}</Text>
                        <Text style={[styles.statLabel, styles.completedText]}>Done</Text>
                    </View>
                </View>
            </View>

            <View style={styles.list}>
                {watchingShows.slice(0, 3).map((item) => {
                    const showTitle = item.showDetails?.name || `Show ${item.show_id}`;
                    const posterUrl = item.showDetails?.poster_path
                        ? tmdbService.getImageURL(item.showDetails.poster_path, 'w185')
                        : null;

                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.card}
                            onPress={() => handleShowPress(item)}
                        >
                            {posterUrl ? (
                                <Image source={{ uri: posterUrl }} style={styles.poster} />
                            ) : (
                                <View style={styles.placeholderPoster}>
                                    <Ionicons name="tv-outline" size={24} color={Colors.textMuted} />
                                </View>
                            )}
                            <View style={styles.cardContent}>
                                <Text style={styles.showTitle} numberOfLines={1}>{showTitle}</Text>
                                <Text style={styles.episodeText}>
                                    S{item.current_season} : E{item.current_episode}
                                </Text>
                                <View style={styles.progressBarBg}>
                                    <View
                                        style={[
                                            styles.progressBarFill,
                                            { width: `${Math.min((item.current_episode / (item.showDetails?.number_of_episodes || 1)) * 100, 100)}%` }
                                        ]}
                                    />
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    completedBadge: {
        backgroundColor: Colors.success + '20', // 20% opacity
        borderColor: Colors.success + '40',
    },
    statValue: {
        fontWeight: 'bold',
        color: Colors.text,
        fontSize: 12,
    },
    statLabel: {
        color: Colors.textSecondary,
        fontSize: 12,
    },
    completedText: {
        color: Colors.success,
    },
    list: {
        gap: 12,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 10,
        alignItems: 'center',
    },
    poster: {
        width: 40,
        height: 60,
        borderRadius: 6,
        backgroundColor: Colors.card,
    },
    placeholderPoster: {
        width: 40,
        height: 60,
        borderRadius: 6,
        backgroundColor: Colors.card,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardContent: {
        flex: 1,
        marginLeft: 12,
    },
    showTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 4,
    },
    episodeText: {
        fontSize: 13,
        color: Colors.primary,
        marginBottom: 6,
    },
    progressBarBg: {
        height: 4,
        backgroundColor: Colors.border,
        borderRadius: 2,
        width: '100%',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 2,
    },
});
