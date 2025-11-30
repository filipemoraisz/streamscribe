/**
 * QuickActionsGrid Example Usage
 * 
 * This example demonstrates how to integrate the QuickActionsGrid component
 * into a profile screen with navigation.
 */

import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { QuickActionsGrid, QuickAction } from './QuickActionsGrid';
import { QUICK_ACTIONS } from './quickActionsConfig';

export default function QuickActionsExample() {
  const router = useRouter();

  const handleActionPress = (action: QuickAction) => {
    // Navigate to the specified route
    router.push(action.route as any);
  };

  return (
    <View>
      <QuickActionsGrid
        actions={QUICK_ACTIONS}
        onActionPress={handleActionPress}
      />
    </View>
  );
}

/**
 * Example with notification badge:
 * 
 * const actionsWithBadge = QUICK_ACTIONS.map(action => 
 *   action.id === 'notifications' 
 *     ? { ...action, badge: unreadNotificationCount }
 *     : action
 * );
 * 
 * <QuickActionsGrid
 *   actions={actionsWithBadge}
 *   onActionPress={handleActionPress}
 * />
 */
