import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BorderRadius, BrandTokens, Spacing, Typography } from '../../constants/BrandTokens';

export interface AchievementBadgeProps {
  text: string;
  icon?: string;
  variant?: 'success' | 'points' | 'level';
  style?: ViewStyle;
}

/**
 * AchievementBadge Component
 * 
 * Pill-shaped badge for displaying achievements, points, and level information.
 * Features brand lime background, accessible text color, and optional icon.
 */
export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  text,
  icon = '⭐',
  variant = 'success',
  style,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'points':
        return {
          backgroundColor: BrandTokens.brandLime,
          textColor: BrandTokens.bgDarkGray,
        };
      case 'level':
        return {
          backgroundColor: BrandTokens.accentPurple,
          textColor: BrandTokens.white,
        };
      case 'success':
      default:
        return {
          backgroundColor: BrandTokens.success,
          textColor: BrandTokens.white,
        };
    }
  };

  const variantStyles = getVariantStyles();

  const badgeStyle = [
    styles.badge,
    { backgroundColor: variantStyles.backgroundColor },
    style,
  ];

  const textStyle = [
    styles.text,
    { color: variantStyles.textColor },
  ];

  return (
    <View
      style={badgeStyle}
      accessible={true}
      accessibilityLabel={`${variant} badge: ${text}`}
      accessibilityRole="text"
    >
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={textStyle}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: 12,
    marginRight: Spacing.xs,
  },
  text: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
});