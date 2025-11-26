import { Stack } from 'expo-router';
import { Colors } from '../../../constants/Colors';

export default function SearchLayout() {
    return (
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
            <Stack.Screen name="index" />
        </Stack>
    );
}
