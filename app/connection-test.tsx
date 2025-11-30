import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { Colors } from '@/constants/Colors';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ConnectionTestScreen() {
  const [isConnected, setIsConnected] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const simulateOffline = () => {
    setIsConnected(false);
    setIsConnecting(false);
  };

  const simulateReconnecting = () => {
    setIsConnected(false);
    setIsConnecting(true);
  };

  const simulateOnline = () => {
    setIsConnecting(false);
    setIsConnected(true);
  };

  const simulateFullCycle = async () => {
    // Start offline
    setIsConnected(false);
    setIsConnecting(false);

    // After 2 seconds, start reconnecting
    setTimeout(() => {
      setIsConnecting(true);
    }, 2000);

    // After 4 seconds, go online (will show "Synced" for 3 seconds)
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
    }, 4000);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Connection Banner - This is what we're testing */}
      <ConnectionBanner
        isConnected={isConnected}
        isConnecting={isConnecting}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connection Banner Test</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Current State</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Connected:</Text>
            <Text style={[styles.statusValue, { color: isConnected ? '#4CAF50' : '#F44336' }]}>
              {isConnected ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Connecting:</Text>
            <Text style={[styles.statusValue, { color: isConnecting ? '#FF9800' : Colors.textSecondary }]}>
              {isConnecting ? 'Yes' : 'No'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manual Controls</Text>
          <Text style={styles.sectionDescription}>
            Test each state individually
          </Text>

          <TouchableOpacity
            style={[styles.button, styles.offlineButton]}
            onPress={simulateOffline}
          >
            <Ionicons name="cloud-offline" size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>Simulate Offline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.reconnectingButton]}
            onPress={simulateReconnecting}
          >
            <Ionicons name="sync" size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>Simulate Reconnecting</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.onlineButton]}
            onPress={simulateOnline}
          >
            <Ionicons name="cloud-done" size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>Simulate Online</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Automated Test</Text>
          <Text style={styles.sectionDescription}>
            Watch the full connection cycle with animations
          </Text>

          <TouchableOpacity
            style={[styles.button, styles.cycleButton]}
            onPress={simulateFullCycle}
          >
            <Ionicons name="play-circle" size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>Run Full Cycle (7s)</Text>
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Full Cycle Timeline:</Text>
            <Text style={styles.infoText}>• 0s: Goes offline</Text>
            <Text style={styles.infoText}>• 2s: Starts reconnecting</Text>
            <Text style={styles.infoText}>• 4s: Connects (shows &quot;Synced&quot;)</Text>
            <Text style={styles.infoText}>• 7s: &quot;Synced&quot; fades out</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expected Behavior</Text>

          <View style={styles.behaviorCard}>
            <View style={styles.behaviorHeader}>
              <View style={[styles.stateDot, { backgroundColor: '#F44336' }]} />
              <Text style={styles.behaviorTitle}>Offline State</Text>
            </View>
            <Text style={styles.behaviorText}>
              Black banner with white text: &quot;You&apos;re offline. Changes will sync when online.&quot;
            </Text>
          </View>

          <View style={styles.behaviorCard}>
            <View style={styles.behaviorHeader}>
              <View style={[styles.stateDot, { backgroundColor: '#FF9800' }]} />
              <Text style={styles.behaviorTitle}>Reconnecting State</Text>
            </View>
            <Text style={styles.behaviorText}>
              Black banner with white text: &quot;Reconnecting...&quot;
            </Text>
          </View>

          <View style={styles.behaviorCard}>
            <View style={styles.behaviorHeader}>
              <View style={[styles.stateDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.behaviorTitle}>Synced State</Text>
            </View>
            <Text style={styles.behaviorText}>
              Black banner with GREEN text: &quot;Synced.&quot; (fades out after 3 seconds)
            </Text>
          </View>

          <View style={styles.behaviorCard}>
            <View style={styles.behaviorHeader}>
              <View style={[styles.stateDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.behaviorTitle}>Online State</Text>
            </View>
            <Text style={styles.behaviorText}>
              No banner shown (clean interface)
            </Text>
          </View>
        </View>

        <View style={styles.demoContent}>
          <Text style={styles.demoTitle}>Demo Content Below</Text>
          <Text style={styles.demoText}>
            This simulates your actual app content. The banner should appear at the very top,
            above all content, and respect the safe area (notch).
          </Text>

          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.demoCard}>
              <Text style={styles.demoCardText}>Content Card {i}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  statusCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  offlineButton: {
    backgroundColor: '#F44336',
  },
  reconnectingButton: {
    backgroundColor: '#FF9800',
  },
  onlineButton: {
    backgroundColor: '#4CAF50',
  },
  cycleButton: {
    backgroundColor: Colors.primary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoBox: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  behaviorCard: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  behaviorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  stateDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  behaviorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  behaviorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  demoContent: {
    marginTop: 24,
  },
  demoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  demoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  demoCard: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  demoCardText: {
    fontSize: 16,
    color: Colors.text,
  },
});
