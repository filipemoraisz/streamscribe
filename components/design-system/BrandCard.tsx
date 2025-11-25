import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BorderRadius, BrandTokens, Shadows } from '../../constants/BrandTokens';

export interface BrandCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  topRadius?: boolean;
  testID?: string;
}

/**
 * BrandCard Component
 * 
 * Rounded white card with brand styling following the design system.
 * Features 24px border radius (top), subtle shadow, and white background.
 */
export const BrandCard: React.FC<BrandCardProps> = ({
  children,
  style,
  topRadius = false,
  testID,
}) => {
  const cardStyle = [
    styles.card,
    topRadius && styles.topRadius,
    style,
  ];

  return (
    <View style={cardStyle} testID={testID}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: BrandTokens.white,
    borderRadius: BorderRadius.xl,
    ...Shadows.card,
  },
  topRadius: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
});