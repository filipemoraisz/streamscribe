import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Switch,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../constants/Colors';
import { BrandTokens, Typography, Spacing, BorderRadius } from '../constants/BrandTokens';
import { PrimaryCTA } from '../components/design-system/PrimaryCTA';
import { notificationManager } from '../services';
import { useNotificationPermissions } from '../components/hooks/useNotificationPermissions';
import type { NotificationPreferences } from '../types';

export default function NotificationSettingsScreen() {
  const [permissionState, permissionActions] = useNotificationPermissions();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const prefs = await notificationManager.getPreferences();

      // If no preferences exist, create default ones
      if (!prefs) {
        const defaultPrefs: NotificationPreferences = {
          userId: '',
          episodeReleases: true,
          streamingUpdates: true,
          recommendations: true,
          progressSync: true,
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00',
          },
          frequency: 'immediate',
          updatedAt: new Date().toISOString(),
        };
        setPreferences(defaultPrefs);
      } else {
        // Ensure quietHours exists in case of old preferences
        const safePrefs = {
          ...prefs,
          quietHours: prefs.quietHours || {
            enabled: false,
            start: '22:00',
            end: '08:00',
          }
        };
        setPreferences(safePrefs);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      Alert.alert('Error', 'Failed to load notification preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async (updatedPrefs: NotificationPreferences) => {
    try {
      setIsSaving(true);
      await notificationManager.updatePreferences(updatedPrefs);
      setPreferences(updatedPrefs);
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      Alert.alert('Error', 'Failed to save notification preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: any) => {
    if (!preferences) return;

    const updatedPrefs = { ...preferences, [key]: value };
    savePreferences(updatedPrefs);
  };

  const updateQuietHours = (key: 'enabled' | 'start' | 'end', value: any) => {
    if (!preferences) return;

    const updatedPrefs = {
      ...preferences,
      quietHours: {
        ...(preferences.quietHours || { enabled: false, start: '22:00', end: '08:00' }),
        [key]: value,
      },
    };
    savePreferences(updatedPrefs);
  };

  const handleTimeChange = (event: any, selectedTime?: Date, type?: 'start' | 'end') => {
    if (Platform.OS === 'android') {
      setShowStartTimePicker(false);
      setShowEndTimePicker(false);
    }

    if (selectedTime && type) {
      const timeString = selectedTime.toTimeString().slice(0, 5); // HH:MM format
      updateQuietHours(type, timeString);
    }
  };

  const parseTime = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const handleTestNotification = async () => {
    try {
      if (!permissionState.hasPermission) {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications first to test them.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Enable', onPress: permissionActions.requestPermission },
          ]
        );
        return;
      }

      await notificationManager.sendTestNotification();
      Alert.alert('Test Sent', 'A test notification has been sent!');
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const handleResetPermissions = async () => {
    Alert.alert(
      'Reset Notification Settings',
      'This will reset all notification permission tracking. You may be prompted for permissions again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await permissionActions.resetPermissionState();
            Alert.alert('Reset Complete', 'Notification settings have been reset.');
          },
        },
      ]
    );
  };

  if (isLoading || !preferences) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Notification Settings',
            headerShown: true,
          }}
        />
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading preferences...</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Notification Settings',
          headerShown: true,
        }}
      />
      <View style={styles.container}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Permission Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Permission Status</Text>
            <View style={styles.permissionCard}>
              <View style={styles.permissionStatus}>
                <Ionicons
                  name={permissionState.hasPermission ? 'checkmark-circle' : 'alert-circle'}
                  size={24}
                  color={permissionState.hasPermission ? BrandTokens.success : BrandTokens.warning}
                />
                <Text style={styles.permissionText}>
                  {permissionState.hasPermission
                    ? 'Notifications are enabled'
                    : 'Notifications are disabled'}
                </Text>
              </View>
              {!permissionState.hasPermission && (
                <PrimaryCTA
                  title="Enable Notifications"
                  onPress={permissionActions.requestPermission}
                  loading={permissionState.isLoading}
                  style={styles.enableButton}
                />
              )}
            </View>
          </View>

          {/* Notification Types */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Types</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>New Episodes</Text>
                <Text style={styles.settingDescription}>Get notified when new episodes air</Text>
              </View>
              <Switch
                value={preferences.episodeReleases}
                onValueChange={(value) => updatePreference('episodeReleases', value)}
                trackColor={{ false: Colors.surface, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Streaming Updates</Text>
                <Text style={styles.settingDescription}>When shows are available on your services</Text>
              </View>
              <Switch
                value={preferences.streamingUpdates}
                onValueChange={(value) => updatePreference('streamingUpdates', value)}
                trackColor={{ false: Colors.surface, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Recommendations</Text>
                <Text style={styles.settingDescription}>Personalized suggestions based on your taste</Text>
              </View>
              <Switch
                value={preferences.recommendations}
                onValueChange={(value) => updatePreference('recommendations', value)}
                trackColor={{ false: Colors.surface, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Progress Sync</Text>
                <Text style={styles.settingDescription}>Updates about your watch progress</Text>
              </View>
              <Switch
                value={preferences.progressSync}
                onValueChange={(value) => updatePreference('progressSync', value)}
                trackColor={{ false: Colors.surface, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          {/* Quiet Hours */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quiet Hours</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable Quiet Hours</Text>
                <Text style={styles.settingDescription}>Mute notifications during specific times</Text>
              </View>
              <Switch
                value={preferences.quietHours?.enabled ?? false}
                onValueChange={(value) => updateQuietHours('enabled', value)}
                trackColor={{ false: Colors.surface, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            {preferences.quietHours?.enabled && (
              <View style={styles.timePickerContainer}>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Text style={styles.timeLabel}>Start Time</Text>
                  <Text style={styles.timeValue}>{preferences.quietHours.start}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Text style={styles.timeLabel}>End Time</Text>
                  <Text style={styles.timeValue}>{preferences.quietHours.end}</Text>
                </TouchableOpacity>
              </View>
            )}

            {showStartTimePicker && (
              <DateTimePicker
                value={parseTime(preferences.quietHours?.start || '22:00')}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={(e, date) => handleTimeChange(e, date, 'start')}
              />
            )}

            {showEndTimePicker && (
              <DateTimePicker
                value={parseTime(preferences.quietHours?.end || '08:00')}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={(e, date) => handleTimeChange(e, date, 'end')}
              />
            )}
          </View>

          {/* Debug / Testing */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Testing & Debug</Text>
            <TouchableOpacity
              style={styles.testButton}
              onPress={handleTestNotification}
            >
              <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
              <Text style={styles.testButtonText}>Send Test Notification</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.testButton, styles.resetButton]}
              onPress={handleResetPermissions}
            >
              <Ionicons name="refresh-outline" size={20} color={Colors.error} />
              <Text style={[styles.testButtonText, styles.resetButtonText]}>Reset Permissions</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </View>
    </>
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
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  section: {
    marginBottom: Spacing.xl,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  permissionCard: {
    gap: Spacing.md,
  },
  permissionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  permissionText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
  enableButton: {
    width: '100%',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingInfo: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  settingLabel: {
    ...Typography.bodyBold,
    color: Colors.text,
  },
  settingDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  timePickerContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  timeButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  timeValue: {
    ...Typography.h3,
    color: Colors.primary,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  testButtonText: {
    ...Typography.bodyBold,
    color: Colors.primary,
  },
  resetButton: {
    borderColor: Colors.error,
    marginTop: Spacing.sm,
  },
  resetButtonText: {
    color: Colors.error,
  },
});