import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { BrandTokens, Spacing, Typography } from '../constants/BrandTokens';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  onRetry,
  retrying = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
      </View>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity
        style={[styles.button, retrying && styles.buttonDisabled]}
        onPress={onRetry}
        disabled={retrying}
      >
        {retrying ? (
          <ActivityIndicator color={Colors.text} size="small" />
        ) : (
          <>
            <Ionicons name="refresh" size={20} color={Colors.text} style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Retry</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxxl,
    minHeight: 200,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
    opacity: 0.8,
  },
  message: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    maxWidth: 300,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 120,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: Spacing.xs,
  },
  buttonText: {
    ...Typography.button,
    color: Colors.text,
    fontSize: 14,
  },
});
