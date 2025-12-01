/**
 * WelcomeModal Example Usage
 * 
 * This example demonstrates how to integrate the WelcomeModal component
 * with the OnboardingService for first-time user onboarding.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import WelcomeModal from './WelcomeModal';
import { onboardingService } from '../services/onboarding';

export default function WelcomeModalExample() {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const hasSeenWelcome = await onboardingService.hasSeenWelcome();
      setShowWelcome(!hasSeenWelcome);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    }
  };

  const handleGetStarted = async () => {
    try {
      await onboardingService.markWelcomeSeen();
      setShowWelcome(false);
    } catch (error) {
      console.error('Error marking welcome as seen:', error);
      // Still close the modal even if storage fails
      setShowWelcome(false);
    }
  };

  const handleDismiss = () => {
    setShowWelcome(false);
  };

  return (
    <View style={styles.container}>
      <WelcomeModal
        visible={showWelcome}
        onDismiss={handleDismiss}
        onGetStarted={handleGetStarted}
      />
      
      {/* Your app content here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
