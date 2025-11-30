import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { BrandTokens, Typography, Spacing, BorderRadius } from '../constants/BrandTokens';
import { achievementNotificationsService } from '../services/achievementNotifications';
import type { AchievementNotificationPreferences } from '../types';

export default function AchievementSettingsScreen() {
  // const { user } = useAuth();
  const [preferences, setPreferences] = useState<AchievementNotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const prefs = await achievementNotificationsService.getPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
      Alert.alert('Error', 'Failed to load notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (key: keyof AchievementNotificationPreferences) => {
    if (!preferences) return;

    const newPreferences = {
      ...preferences,
      [key]: !preferences[key],
    };

    // Optimistic update
    setPreferences(newPreferences);

    try {
      await achievementNotificationsService.updatePreferences(newPreferences);
    } catch (error) {
      console.error('Error updating preference:', error);
      // Revert on error
      setPreferences(preferences);
      Alert.alert('Error', 'Failed to save setting');
    }
  };

  const handleReset = async () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all notification settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSaving(true);
              const defaultPrefs = await achievementNotificationsService.resetPreferences();
              setPreferences(defaultPrefs);
              Alert.alert('Success', 'Settings reset to default');
            } catch (error) {
              console.error('Error resetting preferences:', error);
              Alert.alert('Error', 'Failed to reset settings');
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Notification Settings',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievement Alerts</Text>
          <Text style={styles.sectionDescription}>
            Control which achievement events trigger notifications.
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Achievement Unlocked</Text>
              <Text style={styles.settingDescription}>
                Get notified when you unlock a new achievement
              </Text>
            </View>
            <Switch
              value={preferences?.achievement_unlocked ?? true}
              onValueChange={() => handleToggle('achievement_unlocked')}
              trackColor={{ false: Colors.surface, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Progress Updates</Text>
              <Text style={styles.settingDescription}>
                Get notified when you make significant progress (50%, 90%)
              </Text>
            </View>
            <Switch
              value={preferences?.progress_updates ?? true}
              onValueChange={() => handleToggle('progress_updates')}
              trackColor={{ false: Colors.surface, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Rare Achievements</Text>
              <Text style={styles.settingDescription}>
                Special effects for rare achievement unlocks
              </Text>
            </View>
            <Switch
              value={preferences?.rare_achievements ?? true}
              onValueChange={() => handleToggle('rare_achievements')}
              trackColor={{ false: Colors.surface, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sound & Haptics</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Sound Effects</Text>
              <Text style={styles.settingDescription}>
                Play sounds when achievements are unlocked
              </Text>
            </View>
            <Switch
              value={preferences?.sound_enabled ?? true}
              onValueChange={() => handleToggle('sound_enabled')}
              trackColor={{ false: Colors.surface, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Haptic Feedback</Text>
              <Text style={styles.settingDescription}>
                Vibrate when achievements are unlocked
              </Text>
            </View>
            <Switch
              value={preferences?.haptic_enabled ?? true}
              onValueChange={() => handleToggle('haptic_enabled')}
              trackColor={{ false: Colors.surface, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.resetButton, isSaving && styles.disabledButton]}
          onPress={handleReset}
          disabled={isSaving}
        >
          <Text style={styles.resetButtonText}>Reset to Defaults</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  settingInfo: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  resetButton: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  resetButtonText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
});
