import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

interface WatchlistActionButtonProps {
    onPress: () => void;
    label?: string;
    style?: ViewStyle;
    icon?: keyof typeof Ionicons.glyphMap;
}

export const WatchlistActionButton: React.FC<WatchlistActionButtonProps> = ({ onPress, label, style, icon = "play" }) => {
    return (
        <TouchableOpacity
            style={[
                styles.container,
                label ? styles.containerWithLabel : styles.containerIconOnly,
                style
            ]}
            onPress={onPress}
        >
            {label && <Text style={styles.label}>{label}</Text>}
            <Ionicons name={icon} size={10} color="white" style={label ? styles.iconWithLabel : undefined} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#C85C1E',
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    containerIconOnly: {
        width: 36,
        height: 20,
    },
    containerWithLabel: {
        paddingHorizontal: 8,
        height: 20,
    },
    label: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
        marginRight: 4,
    },
    iconWithLabel: {
        // No specific style needed if margin is on label, but keeping for flexibility
    }
});
