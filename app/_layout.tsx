import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AchievementNotificationProvider } from "../components/AchievementNotificationProvider";
import { Colors } from "../constants/Colors";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { notificationDeepLinkingService } from "../services/notificationDeepLinking";
import { realTimeManager } from "../services/realtime";
import { notificationManager } from "../services/notifications";

function RootLayoutNav() {
  const { user, preferences, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (user && !inAuthGroup && !inOnboardingGroup) {
      // User is authenticated, check onboarding status
      if (preferences === null) {
        // Preferences not loaded yet, wait
        return;
      }
      
      if (!preferences.onboarding_completed) {
        // Redirect to onboarding if not completed
        router.replace('/(onboarding)/services');
      }
    } else if (user && inAuthGroup) {
      // Redirect to home if authenticated and trying to access auth screens
      router.replace('/(tabs)');
    } else if (user && inOnboardingGroup && preferences?.onboarding_completed && segments[1] !== 'services') {
      // Redirect to home if authenticated, in onboarding, but already completed it
      // EXCEPT for the services screen which can be accessed from settings
      router.replace('/(tabs)');
    }
  }, [user, preferences, loading, segments]);

  // Initialize services - NON-BLOCKING for better startup performance
  useEffect(() => {
    // Fire and forget - don't block UI rendering
    notificationDeepLinkingService.initialize();
    
    // Initialize in background without awaiting
    notificationManager.initialize()
      .then(() => console.log('Notification manager initialized'))
      .catch(error => console.error('Error initializing notification manager:', error));
    
    return () => {
      notificationDeepLinkingService.cleanup();
      realTimeManager.disconnect();
      notificationManager.cleanup();
    };
  }, []);

  // Connect real-time manager only after user is authenticated
  useEffect(() => {
    if (user && !loading) {
      console.log('User authenticated, connecting real-time manager');
      realTimeManager.connect()
        .then(() => console.log('Real-time manager connected'))
        .catch(error => console.error('Error connecting real-time manager:', error));
    } else if (!user && !loading) {
      console.log('User not authenticated, disconnecting real-time manager');
      realTimeManager.disconnect();
      
      // Also cleanup notification manager to prevent errors
      notificationManager.cleanup();
    }
  }, [user, loading]);

  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerTintColor: Colors.text,
          headerTitleStyle: {
            fontWeight: 'bold',
            color: Colors.text,
          },
          // @ts-ignore
          headerBackTitleVisible: false,
          contentStyle: {
            backgroundColor: Colors.background,
          },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="details/[type]/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="season/[showId]/[seasonNumber]" options={{ headerShown: true }} />
        <Stack.Screen name="episode/[showId]/[seasonNumber]/[episodeNumber]" options={{ headerShown: true }} />
        <Stack.Screen name="achievements-list" options={{ headerShown: true, title: 'Achievements' }} />
        <Stack.Screen name="achievement-settings" options={{ headerShown: true, title: 'Achievement Settings' }} />
        <Stack.Screen name="debug" options={{ headerShown: true }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthProvider>
          <AchievementNotificationProvider>
            <RootLayoutNav />
          </AchievementNotificationProvider>
        </AuthProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
