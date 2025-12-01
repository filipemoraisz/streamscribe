import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/BrandTokens';

interface SkeletonLoaderProps {
  type: 'card' | 'header' | 'section';
  count?: number;
  animated?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type,
  count = 1,
  animated = true,
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!animated) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [animated, opacity]);

  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <Animated.View style={[styles.card, { opacity }]}>
            <View style={styles.cardImage} />
            <View style={styles.cardContent}>
              <View style={styles.cardTitle} />
              <View style={styles.cardSubtitle} />
            </View>
          </Animated.View>
        );
      case 'header':
        return (
          <Animated.View style={[styles.header, { opacity }]}>
            <View style={styles.headerTitle} />
            <View style={styles.headerSubtitle} />
          </Animated.View>
        );
      case 'section':
        return (
          <View style={styles.section}>
            <Animated.View style={[styles.sectionTitle, { opacity }]} />
            <View style={styles.sectionCards}>
              {[...Array(3)].map((_, index) => (
                <Animated.View key={index} style={[styles.card, { opacity }]}>
                  <View style={styles.cardImage} />
                  <View style={styles.cardContent}>
                    <View style={styles.cardTitle} />
                    <View style={styles.cardSubtitle} />
                  </View>
                </Animated.View>
              ))}
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  if (type === 'section') {
    return renderSkeleton();
  }

  return (
    <View style={styles.container}>
      {[...Array(count)].map((_, index) => (
        <View key={index}>{renderSkeleton()}</View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: 140,
    marginRight: Spacing.md,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  cardContent: {
    gap: Spacing.xs,
  },
  cardTitle: {
    height: 16,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    width: '80%',
  },
  cardSubtitle: {
    height: 12,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    width: '60%',
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  headerTitle: {
    height: 32,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    width: '60%',
    marginBottom: Spacing.md,
  },
  headerSubtitle: {
    height: 20,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    width: '40%',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    height: 24,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    width: 150,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionCards: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
  },
});
