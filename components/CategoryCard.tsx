import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

interface CategoryCardProps {
    title: string;
    gradientColors: readonly string[] | string[];
    icon: any;
    onPress: () => void;
    style?: ViewStyle;
}

export const CategoryCard = ({ title, gradientColors, icon, onPress, style }: CategoryCardProps) => {
    return (
        <TouchableOpacity onPress={onPress} style={[styles.container, style]} activeOpacity={0.8}>
            <LinearGradient
                colors={gradientColors as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                <Text style={styles.title}>{title}</Text>
                <SymbolView name={icon} size={40} tintColor="rgba(255, 255, 255, 0.8)" style={styles.icon} />
            </LinearGradient>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 100,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    gradient: {
        flex: 1,
        padding: 12,
        justifyContent: 'space-between',
        position: 'relative',
    },
    title: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        zIndex: 2,
        maxWidth: '70%',
    },
    icon: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        transform: [{ rotate: '-15deg' }],
        zIndex: 1,
    },
});
