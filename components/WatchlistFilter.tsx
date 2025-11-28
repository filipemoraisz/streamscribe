import { Colors } from '@/constants/Colors';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type FilterType = 'all' | 'active' | 'up_to_date' | 'completed' | 'movies';

interface WatchlistFilterProps {
    activeFilter: FilterType;
    onFilterChange: (filter: FilterType) => void;
}

export const WatchlistFilter = ({ activeFilter, onFilterChange }: WatchlistFilterProps) => {
    const filters: { id: FilterType; label: string }[] = [
        { id: 'all', label: 'All' },
        { id: 'active', label: 'Active' },
        { id: 'up_to_date', label: 'Up to Date' },
        { id: 'movies', label: 'Movies' },
    ];

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {filters.map((filter) => (
                    <TouchableOpacity
                        key={filter.id}
                        style={[
                            styles.chip,
                            activeFilter === filter.id && styles.chipActive,
                        ]}
                        onPress={() => onFilterChange(filter.id)}
                    >
                        <Text
                            style={[
                                styles.chipText,
                                activeFilter === filter.id && styles.chipTextActive,
                            ]}
                        >
                            {filter.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    chipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    chipText: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.textSecondary,
    },
    chipTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
});
