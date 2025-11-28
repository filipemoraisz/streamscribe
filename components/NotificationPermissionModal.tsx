import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandTokens, Typography, Spacing, BorderRadius, Shadows } from '../constants/BrandTokens';
import { PrimaryCTA } from './design-system/PrimaryCTA';
import { notificationManager } from '../services';

export interface NotificationPermissionModalProps {
  visible: boolean;
  onClose: () => void;
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

/**
 * NotificationPermissionModal Component
 * 
 * Modal that explains the benefits of enabling notifications and requests permission.
 * Provides clear value proposition and graceful fallback options.
 */
export const NotificationPermissionModal: React.FC<NotificationPermissionModalProps> = ({
  visible,
  onClose,
  onPermissionGranted,
  onPermissionDenied,
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const scaleValue = React.useRef(new Animated.Value(0.9)).current;
  const opacityValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleValue, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    
    try {
      const granted = await notificationManager.requestPermissions();
      
      if (granted) {
        // Register for push notifications
        await notificationManager.registerForPushNotifications();
        onPermissionGranted?.();
        onClose();
      } else {
        onPermissionDenied?.();
        // Show fallback options
        Alert.alert(
          'Notifications Disabled',
          'You can still use StreamScribe! Important updates will be shown in the app. You can enable notifications later in Settings.',
          [
            { text: 'OK', onPress: onClose }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      Alert.alert(
        'Permission Error',
        'There was an issue setting up notifications. You can try again later in Settings.',
        [{ text: 'OK', onPress: onClose }]
      );
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSkip = () => {
    onPermissionDenied?.();
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.modal,
            {
              transform: [{ scale: scaleValue }],
              opacity: opacityValue,
            }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons 
                name="notifications" 
                size={32} 
                color={BrandTokens.ctaPink} 
              />
            </View>
            <Text style={styles.title}>Stay Updated</Text>
            <Text style={styles.subtitle}>
              Get notified about new episodes and streaming updates
            </Text>
          </View>

          {/* Benefits */}
          <View style={styles.benefits}>
            <View style={styles.benefit}>
              <Ionicons 
                name="tv" 
                size={20} 
                color={BrandTokens.brandBlue} 
                style={styles.benefitIcon}
              />
              <Text style={styles.benefitText}>
                New episodes from your watchlist
              </Text>
            </View>
            
            <View style={styles.benefit}>
              <Ionicons 
                name="trending-up" 
                size={20} 
                color={BrandTokens.brandBlue} 
                style={styles.benefitIcon}
              />
              <Text style={styles.benefitText}>
                Content availability changes
              </Text>
            </View>
            
            <View style={styles.benefit}>
              <Ionicons 
                name="star" 
                size={20} 
                color={BrandTokens.brandBlue} 
                style={styles.benefitIcon}
              />
              <Text style={styles.benefitText}>
                Personalized recommendations
              </Text>
            </View>
            
            <View style={styles.benefit}>
              <Ionicons 
                name="sync" 
                size={20} 
                color={BrandTokens.brandBlue} 
                style={styles.benefitIcon}
              />
              <Text style={styles.benefitText}>
                Progress sync across devices
              </Text>
            </View>
          </View>

          {/* Privacy Note */}
          <View style={styles.privacyNote}>
            <Ionicons 
              name="shield-checkmark" 
              size={16} 
              color={BrandTokens.mutedGray} 
              style={styles.privacyIcon}
            />
            <Text style={styles.privacyText}>
              We respect your privacy. You can customize notification types and quiet hours in Settings.
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <PrimaryCTA
              title="Enable Notifications"
              onPress={handleRequestPermission}
              loading={isRequesting}
              style={styles.primaryButton}
            />
            
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              disabled={isRequesting}
            >
              <Text style={styles.skipButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modal: {
    backgroundColor: BrandTokens.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...Shadows.elevated,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.pill,
    backgroundColor: `${BrandTokens.ctaPink}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h2,
    color: BrandTokens.bgDarkGray,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: BrandTokens.mutedGray,
    textAlign: 'center',
  },
  benefits: {
    marginBottom: Spacing.xl,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  benefitIcon: {
    marginRight: Spacing.md,
  },
  benefitText: {
    ...Typography.body,
    color: BrandTokens.bgDarkGray,
    flex: 1,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${BrandTokens.mutedGray}10`,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xl,
  },
  privacyIcon: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  privacyText: {
    ...Typography.bodySmall,
    color: BrandTokens.mutedGray,
    flex: 1,
  },
  actions: {
    gap: Spacing.md,
  },
  primaryButton: {
    marginBottom: Spacing.sm,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skipButtonText: {
    ...Typography.body,
    color: BrandTokens.mutedGray,
  },
});