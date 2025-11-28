import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
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
    } else if (user && !inOnboardingGroup && (!preferences || !preferences.onboarding_completed)) {
      // Redirect to onboarding if authenticated but not completed onboarding
      router.replace('/(onboarding)/services');
    } else if (user && inAuthGroup) {
      // Redirect to home if authenticated and trying to access auth screens
      router.replace('/(tabs)');
    } else if (user && inOnboardingGroup && preferences?.onboarding_completed) {
      // Redirect to home if authenticated, in onboarding, but already completed it
      router.replace('/(tabs)');
    }
  }, [user, preferences, loading, segments]);

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize notification services
        notificationDeepLinkingService.initialize();
        await notificationManager.initialize();
        
        // Initialize real-time manager
        await realTimeManager.connect();
        
        console.log('Services initialized successfully');
      } catch (error) {
        console.error('Error initializing services:', error);
      }
    };

    initializeServices();
    
    return () => {
      notificationDeepLinkingService.cleanup();
      realTimeManager.disconnect();
      notificationManager.cleanup();
    };
  }, []);

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
        <Stack.Screen name="debug" options={{ headerShown: true }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ErrorBoundary>
  );
}
