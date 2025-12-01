import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandTokens, Typography, Spacing, BorderRadius, Shadows } from '../constants/BrandTokens';

const { width } = Dimensions.get('window');

interface WelcomeModalProps {
  visible: boolean;
  onDismiss: () => void;
  onGetStarted: () => void;
}

interface FeatureHighlight {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
}

const FEATURES: FeatureHighlight[] = [
  {
    icon: 'stats-chart',
    title: 'Track Your Impact',
    description: 'See how much you save and optimize your streaming subscriptions',
    color: BrandTokens.brandLime,
  },
  {
    icon: 'bookmark',
    title: 'Build Your Watchlist',
    description: 'Save movies and shows you want to watch across all your services',
    color: BrandTokens.ctaPink,
  },
  {
    icon: 'sparkles',
    title: 'Smart Recommendations',
    description: 'Get personalized suggestions based on your taste profile',
    color: BrandTokens.accentPurple,
  },
  {
    icon: 'trophy',
    title: 'Unlock Achievements',
    description: 'Earn badges and points as you watch and discover new content',
    color: BrandTokens.brandBlue,
  },
];

export default function WelcomeModal({
  visible,
  onDismiss,
  onGetStarted,
}: WelcomeModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      scaleAnim.setValue(0.9);

      // Start entrance animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleGetStarted = () => {
    // Animate out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onGetStarted();
      onDismiss();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleGetStarted}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="tv" size={48} color={BrandTokens.brandLime} />
            </View>
            <Text style={styles.title}>Welcome to StreamScribe!</Text>
            <Text style={styles.subtitle}>
              Your personal streaming companion
            </Text>
          </View>

          {/* Features */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <View
                  style={[
                    styles.featureIconContainer,
                    { backgroundColor: `${feature.color}20` },
                  ]}
                >
                  <Ionicons
                    name={feature.icon}
                    size={32}
                    color={feature.color}
                  />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>
                    {feature.description}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Get Started Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.getStartedButton}
              onPress={handleGetStarted}
              activeOpacity={0.8}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={20} color={BrandTokens.white} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContainer: {
    backgroundColor: BrandTokens.white,
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    ...Shadows.elevated,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: BrandTokens.inputGray,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${BrandTokens.brandLime}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    color: BrandTokens.bgDarkGray,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: BrandTokens.mutedGray,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    ...Typography.h2,
    fontSize: 18,
    color: BrandTokens.bgDarkGray,
    marginBottom: Spacing.xs,
  },
  featureDescription: {
    ...Typography.bodySmall,
    color: BrandTokens.mutedGray,
    lineHeight: 20,
  },
  footer: {
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: BrandTokens.inputGray,
  },
  getStartedButton: {
    backgroundColor: BrandTokens.ctaPink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    ...Shadows.button,
  },
  getStartedText: {
    ...Typography.button,
    color: BrandTokens.white,
    marginRight: Spacing.sm,
  },
});
