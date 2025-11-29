import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
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
import { notificationManager, notificationPermissionService } from '../services';
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
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="tv" size={22} color="#FF6B35" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Episode Releases</Text>
                <Text style={styles.settingDescription}>
                  New episodes from your watchlist
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.episodeReleases}
              onValueChange={(value) => updatePreference('episodeReleases', value)}
              trackColor={{ false: Colors.border, true: '#FF6B35' }}
              thumbColor={BrandTokens.white}
              disabled={isSaving}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="trending-up" size={22} color="#FF6B35" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Streaming Updates</Text>
                <Text style={styles.settingDescription}>
                  Content availability changes
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.streamingUpdates}
              onValueChange={(value) => updatePreference('streamingUpdates', value)}
              trackColor={{ false: Colors.border, true: '#FF6B35' }}
              thumbColor={BrandTokens.white}
              disabled={isSaving}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="star" size={22} color="#FF6B35" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Recommendations</Text>
                <Text style={styles.settingDescription}>
                  Personalized content suggestions
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.recommendations}
              onValueChange={(value) => updatePreference('recommendations', value)}
              trackColor={{ false: Colors.border, true: '#FF6B35' }}
              thumbColor={BrandTokens.white}
              disabled={isSaving}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="sync" size={22} color="#FF6B35" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Progress Sync</Text>
                <Text style={styles.settingDescription}>
                  Multi-device synchronization alerts
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.progressSync}
              onValueChange={(value) => updatePreference('progressSync', value)}
              trackColor={{ false: Colors.border, true: '#FF6B35' }}
              thumbColor={BrandTokens.white}
              disabled={isSaving}
            />
          </View>
        </View>

        {/* Quiet Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="moon" size={22} color="#FF6B35" />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Enable Quiet Hours</Text>
                <Text style={styles.settingDescription}>
                  Pause notifications during specified times
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.quietHours?.enabled || false}
              onValueChange={(value) => updateQuietHours('enabled', value)}
              trackColor={{ false: Colors.border, true: '#FF6B35' }}
              thumbColor={BrandTokens.white}
              disabled={isSaving}
            />
          </View>

          {preferences.quietHours?.enabled && (
            <>
              <TouchableOpacity
                style={styles.timeSettingItem}
                onPress={() => setShowStartTimePicker(true)}
                disabled={isSaving}
              >
                <Text style={styles.timeLabel}>Start Time</Text>
                <View style={styles.timeValue}>
                  <Text style={styles.timeText}>{preferences.quietHours?.start || '22:00'}</Text>
                  <Ionicons name="chevron-forward" size={16} color={BrandTokens.mutedGray} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.timeSettingItem}
                onPress={() => setShowEndTimePicker(true)}
                disabled={isSaving}
              >
                <Text style={styles.timeLabel}>End Time</Text>
                <View style={styles.timeValue}>
                  <Text style={styles.timeText}>{preferences.quietHours?.end || '08:00'}</Text>
                  <Ionicons name="chevron-forward" size={16} color={BrandTokens.mutedGray} />
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Frequency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Frequency</Text>
          
          {(['immediate', 'daily', 'weekly'] as const).map((freq) => (
            <TouchableOpacity
              key={freq}
              style={styles.frequencyItem}
              onPress={() => updatePreference('frequency', freq)}
              disabled={isSaving}
            >
              <View style={styles.frequencyLeft}>
                <Text style={styles.frequencyTitle}>
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </Text>
                <Text style={styles.frequencyDescription}>
                  {freq === 'immediate' && 'Receive notifications as they happen'}
                  {freq === 'daily' && 'Receive a daily digest of notifications'}
                  {freq === 'weekly' && 'Receive a weekly summary of notifications'}
                </Text>
              </View>
              <View style={styles.radioButton}>
                {preferences.frequency === freq && (
                  <View style={styles.radioButtonSelected} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleTestNotification}
            disabled={isSaving}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="send" size={22} color="#FF6B35" />
              <Text style={styles.actionText}>Send Test Notification</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleResetPermissions}
            disabled={isSaving}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="refresh" size={22} color={BrandTokens.warning} />
              <Text style={[styles.actionText, { color: BrandTokens.warning }]}>
                Reset Permission Settings
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Time Pickers */}
      {showStartTimePicker && (
        <DateTimePicker
          value={parseTime(preferences.quietHours?.start || '22:00')}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={(event, time) => handleTimeChange(event, time, 'start')}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={parseTime(preferences.quietHours?.end || '08:00')}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={(event, time) => handleTimeChange(event, time, 'end')}
        />
      )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: BrandTokens.mutedGray,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  permissionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  permissionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  permissionText: {
    ...Typography.body,
    color: Colors.text,
    marginLeft: Spacing.md,
    flex: 1,
  },
  enableButton: {
    marginTop: Spacing.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextContainer: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  settingTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  settingDescription: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  timeSettingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  timeLabel: {
    ...Typography.body,
    color: Colors.text,
  },
  timeValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    ...Typography.body,
    fontWeight: '600',
    color: BrandTokens.brandBlue,
    marginRight: Spacing.sm,
  },
  frequencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  frequencyLeft: {
    flex: 1,
  },
  frequencyTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  frequencyDescription: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B35',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    ...Typography.body,
    fontWeight: '500',
    color: Colors.text,
    marginLeft: Spacing.md,
  },
});