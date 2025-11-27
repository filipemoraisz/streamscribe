import { Colors } from '@/constants/Colors';
import { tmdbService } from '@/services/tmdb';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MovieCardProps {
    id: number;
    title: string;
    posterPath: string | null;
    rating: number;
    type: 'movie' | 'tv';
}

export const MovieCard = ({ id, title, posterPath, rating, type }: MovieCardProps) => {
    return (
        <Link href={`/details/${type}/${id}`} asChild>
            <TouchableOpacity style={styles.card}>
                <View style={styles.imageContainer}>
                    {posterPath ? (
                        <Image
                            source={{ uri: tmdbService.getImageURL(posterPath, 'w342') || '' }}
                            style={styles.image}
                        />
                    ) : (
                        <View style={[styles.image, styles.placeholder]}>
                            <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
                        </View>
                    )}
                    <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={12} color={Colors.warning} />
                        <Text style={styles.rating}>{rating.toFixed(1)}</Text>
                    </View>
                </View>
                <Text style={styles.title} numberOfLines={2}>
                    {title}
                </Text>
            </TouchableOpacity>
        </Link>
    );
};

const styles = StyleSheet.create({
    card: {
        width: 140,
        marginRight: 16,
    },
    imageContainer: {
        height: 210,
        borderRadius: 12,
        backgroundColor: Colors.surface,
        marginBottom: 8,
        overflow: 'hidden',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
        backgroundColor: Colors.surface,
    },
    placeholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    ratingContainer: {
        position: 'absolute',
        top: 8,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    rating: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
    },
});
