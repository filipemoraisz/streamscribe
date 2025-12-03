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
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.container}
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
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: 4,
        paddingBottom: 8,
        backgroundColor: 'transparent',
    },
    scrollContent: {
        paddingLeft: 0,
        paddingRight: 0,
        gap: 4,
    },
    chip: {
        paddingHorizontal: 15,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    chipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '500',
        color: Colors.textSecondary,
    },
    chipTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
});
