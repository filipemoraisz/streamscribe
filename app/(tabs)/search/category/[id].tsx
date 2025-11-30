import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { MediaCard } from '../../../../components/MediaCard';
import { Colors } from '../../../../constants/Colors';
import { useAuth } from '../../../../contexts/AuthContext';
import { storageService } from '../../../../services/storage';
import { tmdbService } from '../../../../services/tmdb';
import { Movie, TVShow } from '../../../../types';

export default function CategoryResultsScreen() {
    const { id, title, type } = useLocalSearchParams<{ id: string; title: string; type: 'movie' | 'tv' }>();
    // const { user } = useAuth();
    const [results, setResults] = useState<(Movie | TVShow)[]>([]);
    const [loading, setLoading] = useState(true);
    const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadCategoryContent();
        loadWatchlist();
    }, [id, type]);

    const loadWatchlist = async () => {
        try {
            const watchlist = await storageService.getWatchlist();
            const ids = new Set(watchlist.map(item => `${item.type}-${item.id}`));
            setWatchlistIds(ids);
        } catch (error) {
            console.error('Error loading watchlist:', error);
        }
    };

    const loadCategoryContent = async () => {
        setLoading(true);
        try {
            let data: (Movie | TVShow)[] = [];

            // Handle special categories
            if (id === 'trending') {
                data = type === 'movie' ? await tmdbService.getTrendingMovies() : await tmdbService.getTrendingTVShows();
            } else if (id === 'top_rated') {
                data = type === 'movie' ? await tmdbService.getTopRatedMovies() : await tmdbService.getTopRatedTVShows();
            } else if (id === 'upcoming') {
                data = await tmdbService.getUpcomingMovies();
            } else if (id === 'now_playing') {
                data = await tmdbService.getNowPlayingMovies();
            } else if (id === 'airing_today') {
                data = await tmdbService.getAiringTodayTVShows();
            } else if (id === 'on_the_air') {
                data = await tmdbService.getOnTheAirTVShows();
            } else if (id === 'popular') {
                data = type === 'movie' ? await tmdbService.getPopularMovies() : await tmdbService.getPopularTVShows();
            } else {
                // Assume it's a genre ID
                // Note: You might need to add a method to tmdbService to discover by genre if not exists
                // For now, we'll just fetch popular as a fallback or implement discover later
                // Ideally: data = await tmdbService.discoverByGenre(id, type);
                data = type === 'movie' ? await tmdbService.getPopularMovies() : await tmdbService.getPopularTVShows();
            }

            setResults(data);
        } catch (error) {
            console.error('Error loading category:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleItemPress = (item: Movie | TVShow) => {
        const itemType = 'title' in item ? 'movie' : 'tv';
        router.push(`/details/${itemType}/${item.id}`);
    };

    const handleWatchlistPress = async (item: Movie | TVShow) => {
        const itemType = 'title' in item ? 'movie' : 'tv';
        const key = `${itemType}-${item.id}`;
        const itemTitle = 'title' in item ? item.title : item.name;
        const releaseDate = 'title' in item ? item.release_date : item.first_air_date;

        try {
            if (watchlistIds.has(key)) {
                await storageService.removeFromWatchlist(item.id, itemType);
                setWatchlistIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(key);
                    return newSet;
                });
            } else {
                await storageService.addToWatchlist({
                    id: item.id,
                    type: itemType,
                    title: itemTitle,
                    poster_path: item.poster_path,
                    release_date: itemType === 'movie' ? releaseDate : undefined,
                    first_air_date: itemType === 'tv' ? releaseDate : undefined,
                    vote_average: item.vote_average,
                });
                setWatchlistIds(prev => new Set([...prev, key]));
            }
        } catch (error) {
            console.error('Error updating watchlist:', error);
        }
    };

    const isInWatchlist = (id: number, itemType: 'movie' | 'tv') => {
        return watchlistIds.has(`${itemType}-${id}`);
    };

    const renderItem = ({ item }: { item: Movie | TVShow }) => {
        const itemType = 'title' in item ? 'movie' : 'tv';
        return (
            <View style={styles.cardContainer}>
                <MediaCard
                    item={item}
                    type={itemType}
                    onPress={() => handleItemPress(item)}
                    onWatchlistPress={() => handleWatchlistPress(item)}
                    isInWatchlist={isInWatchlist(item.id, itemType)}
                />
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerTitle: title }} />

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={results}
                    renderItem={renderItem}
                    keyExtractor={(item) => `${item.id}`}
                    numColumns={2}
                    contentContainerStyle={styles.listContainer}
                    columnWrapperStyle={styles.row}
                    contentInsetAdjustmentBehavior="automatic"
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    listContainer: {
        padding: 16,
    },
    row: {
        justifyContent: 'space-between',
    },
    cardContainer: {
        width: '48%',
        marginBottom: 16,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
