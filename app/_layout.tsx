import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Colors } from "../constants/Colors";
import { AuthProvider } from "../contexts/AuthContext";

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: Colors.background,
            },
            headerTintColor: Colors.text,
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            contentStyle: {
              backgroundColor: Colors.background,
            },
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="details/[type]/[id]" options={{ headerShown: true }} />
          <Stack.Screen name="season/[showId]/[seasonNumber]" options={{ headerShown: true }} />
          <Stack.Screen name="episode/[showId]/[seasonNumber]/[episodeNumber]" options={{ headerShown: true }} />
          <Stack.Screen name="debug" options={{ headerShown: true }} />
          <Stack.Screen name="index" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </ErrorBoundary>
  );
}
