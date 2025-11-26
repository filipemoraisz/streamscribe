import { Stack } from 'expo-router';
import { Colors } from '../../constants/Colors';

export default function OnboardingLayout() {
    return (
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
                headerBackVisible: false, // Prevent going back
            }}
        >
            <Stack.Screen name="services" options={{ title: 'Select Services' }} />
            <Stack.Screen name="habits" options={{ title: 'Viewing Habits' }} />
            <Stack.Screen name="budget" options={{ title: 'Monthly Budget' }} />
        </Stack>
    );
}
