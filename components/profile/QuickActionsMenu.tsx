import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ProfileColors } from '@/constants/ProfileColors';

export interface QuickAction {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  onPress?: () => void;
  badge?: number;
  destructive?: boolean;
}

interface QuickActionItemProps {
  action: QuickAction;
  onPress: (action: QuickAction) => void;
  isLast?: boolean;
}

const QuickActionItem: React.FC<QuickActionItemProps> = ({ action, onPress, isLast }) => {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (action.onPress) {
      action.onPress();
    } else {
      onPress(action);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.actionItem, isLast && styles.actionItemLast]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={action.label}
      accessibilityRole="button"
      accessibilityHint={`Navigate to ${action.label}`}
    >
      <View style={styles.actionLeft}>
        <View style={[
          styles.iconContainer,
          action.destructive && styles.iconContainerDestructive
        ]}>
          <Ionicons 
            name={action.icon} 
            size={22} 
            color={action.destructive ? ProfileColors.error : ProfileColors.primary} 
          />
        </View>
        <Text style={[
          styles.actionLabel,
          action.destructive && styles.actionLabelDestructive
        ]}>
          {action.label}
        </Text>
      </View>
      
      <View style={styles.actionRight}>
        {action.badge !== undefined && action.badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {action.badge > 99 ? '99+' : action.badge}
            </Text>
          </View>
        )}
        <Ionicons 
          name="chevron-forward" 
          size={20} 
          color={ProfileColors.textMuted} 
        />
      </View>
    </TouchableOpacity>
  );
};

interface QuickActionsMenuProps {
  actions: QuickAction[];
  onActionPress: (action: QuickAction) => void;
}

export const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({
  actions,
  onActionPress,
}) => {
  return (
    <View style={styles.container}>
      {actions.map((action, index) => (
        <QuickActionItem
          key={action.id}
          action={action}
          onPress={onActionPress}
          isLast={index === actions.length - 1}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 102, 0, 0.3)',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 102, 0, 0.15)',
  },
  actionItemLast: {
    borderBottomWidth: 0,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconContainerDestructive: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: ProfileColors.text,
    flex: 1,
  },
  actionLabelDestructive: {
    color: ProfileColors.error,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  badge: {
    backgroundColor: ProfileColors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
});
