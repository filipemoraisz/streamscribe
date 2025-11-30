import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';

export interface QuickAction {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  badge?: number;
}

interface QuickActionCardProps {
  action: QuickAction;
  onPress: (action: QuickAction) => void;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({ action, onPress }) => {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress(action);
  };

  return (
    <TouchableOpacity
      style={styles.actionCard}
      onPress={handlePress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={action.label}
      accessibilityRole="button"
      accessibilityHint={`Navigate to ${action.label}`}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={action.icon} size={32} color={Colors.primary} />
        {action.badge !== undefined && action.badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {action.badge > 99 ? '99+' : action.badge}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.actionLabel}>{action.label}</Text>
    </TouchableOpacity>
  );
};

interface QuickActionsGridProps {
  actions: QuickAction[];
  onActionPress: (action: QuickAction) => void;
}

export const QuickActionsGrid: React.FC<QuickActionsGridProps> = ({
  actions,
  onActionPress,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.grid}>
        {actions.map((action) => (
          <QuickActionCard
            key={action.id}
            action={action}
            onPress={onActionPress}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
  },
});
