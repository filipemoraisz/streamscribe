import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { BrandTokens, Spacing, BorderRadius, AnimationTiming } from '../constants/BrandTokens';

export type QuickFilterType = 'all' | 'movie' | 'tv';

interface QuickFiltersProps {
  activeFilter: QuickFilterType;
  onFilterChange: (filter: QuickFilterType) => void;
}

interface FilterOption {
  id: QuickFilterType;
  label: string;
}

const filters: FilterOption[] = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'TV Shows' },
];

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const QuickFilters: React.FC<QuickFiltersProps> = ({
  activeFilter,
  onFilterChange,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filters.map((filter) => {
          const isActive = activeFilter === filter.id;
          
          return (
            <FilterChip
              key={filter.id}
              filter={filter}
              isActive={isActive}
              onPress={() => onFilterChange(filter.id)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
};

interface FilterChipProps {
  filter: FilterOption;
  isActive: boolean;
  onPress: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ filter, isActive, onPress }) => {
  // Animated styles for smooth transitions
  const animatedChipStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withTiming(
        isActive ? Colors.primary : Colors.surface,
        { duration: AnimationTiming.normal }
      ),
      borderColor: withTiming(
        isActive ? Colors.primary : Colors.border,
        { duration: AnimationTiming.normal }
      ),
      transform: [
        {
          scale: withSpring(isActive ? 1.05 : 1, {
            damping: 15,
            stiffness: 150,
          }),
        },
      ],
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      color: withTiming(
        isActive ? '#FFFFFF' : Colors.textSecondary,
        { duration: AnimationTiming.normal }
      ),
    };
  });

  return (
    <AnimatedTouchableOpacity
      style={[styles.chip, animatedChipStyle]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Animated.Text style={[styles.chipText, animatedTextStyle]}>
        {filter.label}
      </Animated.Text>
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
