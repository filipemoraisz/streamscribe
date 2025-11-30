import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { Achievement, AchievementNotificationPreferences, TIER_COLORS } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AchievementUnlockScreenProps {
  achievement: Achievement;
  visible: boolean;
  onClose: () => void;
  preferences?: AchievementNotificationPreferences;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
}

export const AchievementUnlockScreen: React.FC<AchievementUnlockScreenProps> = ({
  achievement,
  visible,
  onClose,
  preferences,
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [displayedText, setDisplayedText] = useState('');
  const [pointsCount, setPointsCount] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Reanimated values
  const trophyScale = useSharedValue(0);
  const trophyRotation = useSharedValue(0);
  const descriptionOpacity = useSharedValue(0);
  const continuePromptOpacity = useSharedValue(0);

  // Animated values for particles
  const particleAnimations = useRef<Animated.Value[]>([]);

  const tierColors = TIER_COLORS[achievement.tier];

  // Get gradient colors based on tier
  const getGradientColors = (): [string, string, string] => {
    switch (achievement.tier) {
      case 'bronze':
        return ['#3D2817', '#8B5A2B', '#3D2817'];
      case 'silver':
        return ['#2C2C2C', '#808080', '#2C2C2C'];
      case 'gold':
        return ['#3D2F00', '#B8860B', '#3D2F00'];
      case 'platinum':
        return ['#1A1A1A', '#A8A8A8', '#1A1A1A'];
      default:
        return ['#000000', '#333333', '#000000'];
    }
  };

  // Initialize animations when visible
  useEffect(() => {
    if (visible) {
      startAnimationSequence();
      generateParticles();
      playHapticFeedback();
      playSoundEffect();
    } else {
      resetAnimations();
    }

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [visible]);

  const startAnimationSequence = () => {
    // Trophy scale-in with bounce (200-800ms)
    trophyScale.value = withDelay(
      200,
      withSpring(1, {
        damping: 8,
        stiffness: 100,
        mass: 0.5,
      })
    );

    // Trophy rotation for shine effect
    trophyRotation.value = withDelay(
      200,
      withSequence(
        withTiming(10, { duration: 200, easing: Easing.ease }),
        withTiming(-10, { duration: 200, easing: Easing.ease }),
        withTiming(0, { duration: 200, easing: Easing.ease })
      )
    );

    // Description fade-in (1200-1500ms)
    descriptionOpacity.value = withDelay(
      1200,
      withTiming(1, { duration: 300, easing: Easing.ease })
    );

    // Continue prompt pulse (2000ms+)
    continuePromptOpacity.value = withDelay(
      2000,
      withSequence(
        withTiming(1, { duration: 500, easing: Easing.ease }),
        withTiming(0.5, { duration: 800, easing: Easing.ease }),
        withTiming(1, { duration: 800, easing: Easing.ease })
      )
    );

    // Typewriter effect for achievement name (800-1200ms)
    setTimeout(() => {
      typewriterEffect(achievement.name, 800);
    }, 800);

    // Animated points counter (1500-2000ms)
    setTimeout(() => {
      animatePointsCounter(achievement.points);
    }, 1500);
  };

  const typewriterEffect = (text: string, startDelay: number) => {
    let currentIndex = 0;
    const interval = 400 / text.length; // Complete in 400ms

    const timer = setInterval(() => {
      if (currentIndex <= text.length) {
        setDisplayedText(text.substring(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(timer);
      }
    }, interval);
  };

  const animatePointsCounter = (targetPoints: number) => {
    let current = 0;
    const increment = Math.ceil(targetPoints / 50); // 50 steps
    const interval = 500 / 50; // Complete in 500ms

    const timer = setInterval(() => {
      current += increment;
      if (current >= targetPoints) {
        setPointsCount(targetPoints);
        clearInterval(timer);
      } else {
        setPointsCount(current);
      }
    }, interval);
  };

  const generateParticles = () => {
    const newParticles: Particle[] = [];
    const particleCount = 50;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2 - 50;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const velocity = 2 + Math.random() * 3;
      
      newParticles.push({
        id: i,
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 2, // Slight upward bias
        color: i % 3 === 0 ? tierColors.primary : i % 3 === 1 ? tierColors.light : tierColors.dark,
        size: 4 + Math.random() * 4,
      });

      // Create animated value for each particle
      const animValue = new Animated.Value(0);
      particleAnimations.current.push(animValue);

      // Animate particle
      Animated.timing(animValue, {
        toValue: 1,
        duration: 1500 + Math.random() * 500,
        useNativeDriver: true,
      }).start();
    }

    setParticles(newParticles);

    // Animate particles
    setTimeout(() => {
      animateParticles(newParticles);
    }, 500);
  };

  const animateParticles = (particleList: Particle[]) => {
    const interval = setInterval(() => {
      setParticles((prevParticles) =>
        prevParticles.map((particle) => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vy: particle.vy + 0.1, // Gravity
        }))
      );
    }, 16); // ~60fps

    // Clear particles after animation
    setTimeout(() => {
      clearInterval(interval);
      setParticles([]);
    }, 2000);
  };

  const playHapticFeedback = async () => {
    if (!preferences?.haptic_enabled && preferences !== undefined) return;

    try {
      switch (achievement.tier) {
        case 'bronze':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'silver':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'gold':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'platinum':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
      }
    } catch (error) {
      console.log('Haptic feedback not available:', error);
    }
  };

  const playSoundEffect = async () => {
    if (!preferences?.sound_enabled && preferences !== undefined) return;
    if (Platform.OS === 'web') return; // Skip on web

    try {
      // Note: In a real implementation, you would load actual sound files
      // For now, we'll just set up the structure
      const { sound } = await Audio.Sound.createAsync(
        // You would load different sounds based on tier
        // require('../assets/sounds/achievement-unlock.mp3')
        { uri: '' }, // Placeholder - would need actual sound files
        { shouldPlay: false }
      );
      soundRef.current = sound;
      // await sound.playAsync();
    } catch (error) {
      console.log('Sound playback not available:', error);
    }
  };

  const resetAnimations = () => {
    trophyScale.value = 0;
    trophyRotation.value = 0;
    descriptionOpacity.value = 0;
    continuePromptOpacity.value = 0;
    setDisplayedText('');
    setPointsCount(0);
    setParticles([]);
    particleAnimations.current = [];
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just unlocked the "${achievement.name}" achievement in StreamScribe! 🏆 ${achievement.points} points earned!`,
        title: 'Achievement Unlocked!',
      });
    } catch (error) {
      console.log('Error sharing achievement:', error);
    }
  };

  const trophyAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: trophyScale.value },
      { rotate: `${trophyRotation.value}deg` },
    ],
  }));

  const descriptionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: descriptionOpacity.value,
  }));

  const continuePromptAnimatedStyle = useAnimatedStyle(() => ({
    opacity: continuePromptOpacity.value,
  }));

  const getTierDisplayName = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <LinearGradient
          colors={getGradientColors()}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Particles */}
          {particles.map((particle, index) => (
            <Animated.View
              key={particle.id}
              style={[
                styles.particle,
                {
                  left: particle.x,
                  top: particle.y,
                  width: particle.size,
                  height: particle.size,
                  backgroundColor: particle.color,
                  opacity: particleAnimations.current[index]
                    ? particleAnimations.current[index].interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [1, 1, 0],
                      })
                    : 1,
                },
              ]}
            />
          ))}

          {/* Content */}
          <View style={styles.content}>
            {/* Trophy Icon with Glow */}
            <View style={styles.trophyContainer}>
              <View
                style={[
                  styles.glowOuter,
                  { backgroundColor: tierColors.glow },
                ]}
              />
              <View
                style={[
                  styles.glowInner,
                  { backgroundColor: tierColors.glow },
                ]}
              />
              <Reanimated.View style={trophyAnimatedStyle}>
                <Ionicons
                  name={achievement.icon_name as any}
                  size={120}
                  color={tierColors.primary}
                />
              </Reanimated.View>
            </View>

            {/* Tier Badge */}
            <View
              style={[
                styles.tierBadge,
                { backgroundColor: tierColors.primary },
              ]}
            >
              <Text style={styles.tierText}>
                {getTierDisplayName(achievement.tier)}
              </Text>
            </View>

            {/* Achievement Name with Typewriter Effect */}
            <Text style={styles.achievementName}>
              {displayedText}
              {displayedText.length < achievement.name.length && (
                <Text style={styles.cursor}>|</Text>
              )}
            </Text>

            {/* Description with Fade-in */}
            <Reanimated.View style={descriptionAnimatedStyle}>
              <Text style={styles.description}>{achievement.description}</Text>
            </Reanimated.View>

            {/* Points Counter */}
            <View style={styles.pointsContainer}>
              <Ionicons name="star" size={24} color={tierColors.primary} />
              <Text style={[styles.points, { color: tierColors.primary }]}>
                +{pointsCount}
              </Text>
              <Text style={styles.pointsLabel}>points</Text>
            </View>

            {/* Share Button */}
            <Pressable
              style={[
                styles.shareButton,
                { borderColor: tierColors.primary },
              ]}
              onPress={handleShare}
            >
              <Ionicons name="share-social" size={20} color={tierColors.primary} />
              <Text style={[styles.shareText, { color: tierColors.primary }]}>
                Share
              </Text>
            </Pressable>

            {/* Continue Prompt */}
            <Reanimated.View style={continuePromptAnimatedStyle}>
              <Text style={styles.continuePrompt}>Tap to continue</Text>
            </Reanimated.View>
          </View>
        </LinearGradient>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
  },
  trophyContainer: {
    position: 'relative',
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.3,
  },
  glowInner: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.5,
  },
  tierBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  tierText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  achievementName: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
    minHeight: 36,
  },
  cursor: {
    opacity: 0.7,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  points: {
    fontSize: 32,
    fontWeight: '700',
    marginLeft: 8,
  },
  pointsLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    marginBottom: 32,
  },
  shareText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  continuePrompt: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  particle: {
    position: 'absolute',
    borderRadius: 4,
  },
});
