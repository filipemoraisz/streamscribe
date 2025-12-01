import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { 
  PanGestureHandler, 
  TapGestureHandler, 
  State,
  PanGestureHandlerGestureEvent,
  TapGestureHandlerStateChangeEvent
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { RecommendationItem } from '@/types';
import { SwipeOverlay } from './SwipeOverlay';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Swipe thresholds as per requirements
const SWIPE_THRESHOLD = {
  horizontal: 120,
  vertical: 100,
  velocity: 0.3,
};

// Gesture states
type GestureState = 'idle' | 'dragging' | 'returning' | 'exiting';

interface SwipeableCardProps {
  item: RecommendationItem;
  index: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSwipeUp: () => void;
  onPress: () => void;
  disabled: boolean;
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  item,
  index,
  onSwipeRight,
  onSwipeLeft,
  onSwipeUp,
  onPress,
  disabled,
}) => {
  const [gestureState, setGestureState] = useState<GestureState>('idle');
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false); // Subtask 10.2
  
  // Animated values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const isExiting = useSharedValue(false); // Track exit state in worklet
  
  // Refs for gesture handlers
  const panRef = useRef(null);
  const tapRef = useRef(null);

  // Memoize swipe direction calculation (Subtask 10.4)
  const getSwipeDirection = useMemo(() => {
    return (x: number, y: number, vx: number, vy: number): 'left' | 'right' | 'up' | null => {
      'worklet';
      
      // Prioritize distance-based swipe (must meet threshold)
      if (Math.abs(x) > SWIPE_THRESHOLD.horizontal) {
        return x > 0 ? 'right' : 'left';
      }
      if (Math.abs(y) > SWIPE_THRESHOLD.vertical && y < 0) {
        return 'up';
      }
      
      // Only check velocity if we're at least halfway to threshold
      // This prevents accidental triggers when returning to center
      const minDistanceForVelocity = SWIPE_THRESHOLD.horizontal / 2;
      if (Math.abs(x) > minDistanceForVelocity && Math.abs(vx) > 1.0) {
        return vx > 0 ? 'right' : 'left';
      }
      if (Math.abs(y) > SWIPE_THRESHOLD.vertical / 2 && Math.abs(vy) > 1.0 && vy < 0) {
        return 'up';
      }
      
      return null;
    };
  }, []);

  // Memoize overlay opacity calculation (Subtask 10.4)
  const calculateOverlayOpacity = useMemo(() => {
    return (translation: number, threshold: number): number => {
      'worklet';
      const progress = Math.abs(translation) / threshold;
      return Math.min(progress, 1);
    };
  }, []);

  // Update swipe direction for overlay
  const updateSwipeDirection = (direction: 'left' | 'right' | 'up' | null) => {
    setSwipeDirection(direction);
  };

  // Trigger action callbacks
  const triggerAction = (direction: 'left' | 'right' | 'up') => {
    setGestureState('exiting');
    
    switch (direction) {
      case 'right':
        onSwipeRight();
        break;
      case 'left':
        onSwipeLeft();
        break;
      case 'up':
        onSwipeUp();
        break;
    }
  };

  // Pan gesture handler (Subtask 11.3)
  const panGestureHandler = (event: PanGestureHandlerGestureEvent) => {
    'worklet';
    const { translationX, translationY, velocityX, velocityY, state } = event.nativeEvent;
    
    if (state === State.BEGAN) {
      // Prevent new gestures during exit animations (Subtask 11.3, Requirement 4.10)
      if (isExiting.value) return;
      runOnJS(setGestureState)('dragging');
    } else if (state === State.ACTIVE) {
      // Prevent gestures when disabled or during exit (Subtask 11.3)
      if (isExiting.value) return;
      
      translateX.value = translationX;
      translateY.value = translationY;
      
      // Show direction hint immediately when user starts swiping (even small movements)
      // This provides instant visual feedback about what action will happen
      let hintDirection: 'left' | 'right' | 'up' | null = null;
      
      // Determine hint direction based on dominant axis (lower threshold for visual feedback)
      const absX = Math.abs(translationX);
      const absY = Math.abs(translationY);
      
      if (absX > 10 || absY > 10) { // Very low threshold just to show the label
        if (absX > absY) {
          // Horizontal swipe
          hintDirection = translationX > 0 ? 'right' : 'left';
        } else if (translationY < 0) {
          // Vertical swipe (only upward)
          hintDirection = 'up';
        }
      }
      
      runOnJS(updateSwipeDirection)(hintDirection);
    } else if (state === State.END || state === State.CANCELLED) {
      // Prevent processing if disabled or already exiting (Subtask 11.3)
      if (isExiting.value) return;
      
      const direction = getSwipeDirection(
        translationX,
        translationY,
        velocityX,
        velocityY
      );
      
      if (direction) {
        // Swipe threshold met - exit animation
        isExiting.value = true;
        runOnJS(setGestureState)('exiting');
        
        // Exit off-screen
        const exitX = direction === 'left' ? -SCREEN_WIDTH : direction === 'right' ? SCREEN_WIDTH : 0;
        const exitY = direction === 'up' ? -600 : 0;
        
        translateX.value = withTiming(exitX, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        translateY.value = withTiming(exitY, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        opacity.value = withTiming(0, { duration: 300 });
        
        // Trigger action callback
        runOnJS(triggerAction)(direction);
      } else {
        // Return to center
        runOnJS(setGestureState)('returning');
        runOnJS(updateSwipeDirection)(null);
        
        translateX.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
        translateY.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
        
        // Set back to idle after animation completes (Subtask 11.3)
        runOnJS(setGestureState)('idle');
      }
    }
  };

  // Tap gesture handler (Subtask 11.3)
  const handleTap = (event: TapGestureHandlerStateChangeEvent) => {
    // Prevent taps during animations (Subtask 11.3, Requirement 4.10)
    if (disabled || gestureState !== 'idle') return;
    if (event.nativeEvent.state === State.ACTIVE) {
      onPress();
    }
  };

  // Animated styles (Subtask 10.4)
  // Note: useAnimatedStyle automatically uses native driver for optimal performance
  const animatedCardStyle = useAnimatedStyle(() => {
    // Calculate rotation based on horizontal movement
    const rotation = translateX.value / 10;
    
    // Calculate scale based on movement
    const scale = 1 - Math.abs(translateX.value) / 1000;
    
    // Increase zIndex when being dragged to appear on top of other cards
    // Use a much higher base z-index when dragging to ensure it's always on top
    const isDragging = Math.abs(translateX.value) > 5 || Math.abs(translateY.value) > 5;
    
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
        { scale: Math.max(scale, 0.8) },
      ],
      opacity: opacity.value,
      zIndex: isDragging ? 1000 : index,
      elevation: isDragging ? 1000 : 8,
    };
  });

  // Calculate overlay opacity
  const overlayOpacity = useAnimatedStyle(() => {
    if (!swipeDirection) return { opacity: 0 };
    
    const translation = swipeDirection === 'up' 
      ? Math.abs(translateY.value)
      : Math.abs(translateX.value);
    const threshold = swipeDirection === 'up' 
      ? SWIPE_THRESHOLD.vertical 
      : SWIPE_THRESHOLD.horizontal;
    
    // Show overlay more prominently even with small movements
    // Start at 0.4 opacity immediately, then scale up to 1.0 as they approach threshold
    const progress = Math.abs(translation) / threshold;
    const opacity = Math.min(0.4 + (progress * 0.6), 1);
    
    return {
      opacity,
    };
  });

  // Memoize poster URL calculation (Subtask 10.4)
  const posterUrl = useMemo(() => {
    return item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null;
  }, [item.poster_path]);

  // Handle image load error (Subtask 10.2)
  const handleImageError = () => {
    setImageLoadError(true);
  };

  // Cleanup animations on unmount (Subtask 10.4, 11.3)
  // Requirements: 8.9, 4.10
  useEffect(() => {
    return () => {
      // Cancel any ongoing animations gracefully (Subtask 11.3)
      // Set values directly to stop animations without triggering callbacks
      translateX.value = 0;
      translateY.value = 0;
      opacity.value = 1;
      isExiting.value = false;
      
      // Reset gesture state
      setGestureState('idle');
      setSwipeDirection(null);
    };
  }, [translateX, translateY, opacity, isExiting]);

  return (
    <TapGestureHandler
      ref={tapRef}
      waitFor={panRef}
      onHandlerStateChange={handleTap}
    >
      <Animated.View style={{ zIndex: gestureState === 'dragging' ? 1000 : index }}>
        <PanGestureHandler
          ref={panRef}
          onGestureEvent={panGestureHandler}
          onHandlerStateChange={panGestureHandler}
          enabled={!disabled}
          activeOffsetX={[-30, 30]}
          activeOffsetY={[-30, 30]}
        >
          <Animated.View style={[styles.container, animatedCardStyle]}>
            {/* Card content */}
            <View style={styles.card}>
              {posterUrl && !imageLoadError ? (
                <Image 
                  source={{ uri: posterUrl }} 
                  style={styles.poster}
                  onError={handleImageError}
                />
              ) : (
                <View style={[styles.poster, styles.posterPlaceholder]}>
                  <Text style={styles.placeholderText}>No Image</Text>
                </View>
              )}
              
              {/* Card info overlay */}
              <View style={styles.infoOverlay}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
                
                <View style={styles.metadata}>
                  <Text style={styles.rating}>⭐ {item.vote_average.toFixed(1)}</Text>
                  {item.providerName && (
                    <Text style={styles.provider}>{item.providerName}</Text>
                  )}
                </View>
              </View>
              
              {/* Swipe overlay */}
              <Animated.View style={[styles.overlayContainer, overlayOpacity]}>
                <SwipeOverlay direction={swipeDirection} opacity={1} />
              </Animated.View>
            </View>
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </TapGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    width: (SCREEN_WIDTH - 64) / 3, // Fit 3 cards with padding
    height: 240,
    marginHorizontal: 6,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  poster: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  posterPlaceholder: {
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 14,
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  title: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rating: {
    color: '#ffd700',
    fontSize: 11,
    fontWeight: '500',
  },
  provider: {
    color: '#aaa',
    fontSize: 10,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
});
