import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Colors } from '../constants/Colors';

interface CustomTabHeaderProps {
  title?: string;
  logoImage?: any; // For home screen logo image
  headerAnimatedStyle: any;
  rightButton?: ReactNode;
  children?: ReactNode; // For additional content like filters
  height: number;
  paddingTop: number;
}

export function CustomTabHeader({
  title,
  logoImage,
  headerAnimatedStyle,
  rightButton,
  children,
  height,
  paddingTop,
}: CustomTabHeaderProps) {
  return (
    <Animated.View
      style={[
        styles.headerContainer,
        { height, paddingTop }
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, headerAnimatedStyle]}>
        <BlurView
          intensity={80}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.headerContent}>
        <View style={styles.topRow}>
          <View style={styles.brandContainer}>
            <Image
              source={require('@/assets/images/streamscribe_round.png')}
              style={styles.appIcon}
              resizeMode="contain"
            />
            {logoImage ? (
              <Image
                source={logoImage}
                style={styles.logo}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.headerTitle}>{title}</Text>
            )}
          </View>

          {rightButton && <View style={styles.rightButton}>{rightButton}</View>}
        </View>

        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'column',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appIcon: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  logo: {
    width: 120,
    height: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  rightButton: {
    padding: 8,
  },
});
