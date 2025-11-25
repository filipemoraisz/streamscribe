import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { DebugStorage, debugAll } from '../utils/debugStorage';

export default function DebugScreen() {
  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const runDebugCommand = async (command: () => Promise<any>, title: string) => {
    setLoading(true);
    try {
      console.log(`\n=== ${title.toUpperCase()} ===`);
      const result = await command();
      
      // Capture console output for display
      let displayText = `=== ${title} ===\n`;
      if (Array.isArray(result)) {
        displayText += `Found ${result.length} items\n`;
        result.forEach((item, index) => {
          displayText += `${index + 1}. ${JSON.stringify(item, null, 2)}\n`;
        });
      } else if (result) {
        displayText += JSON.stringify(result, null, 2);
      } else {
        displayText += 'No data found';
      }
      
      setOutput(prev => prev + displayText + '\n\n');
    } catch (error) {
      setOutput(prev => prev + `Error in ${title}: ${error}\n\n`);
    } finally {
      setLoading(false);
    }
  };

  const clearOutput = () => {
    setOutput('');
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all users, watchlists, and progress data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await DebugStorage.clearAllData();
            setOutput('All data cleared!\n\n');
          },
        },
      ]
    );
  };

  const runAllDebug = async () => {
    setLoading(true);
    setOutput('');
    try {
      await debugAll();
      setOutput('Check console for detailed output\n\n');
    } catch (error) {
      setOutput(`Error running debug: ${error}\n\n`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Debug Storage',
          headerBackTitle: 'Back',
        }}
      />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => runDebugCommand(DebugStorage.getAllUsers, 'All Users')}
            disabled={loading}
          >
            <Ionicons name="people" size={20} color={Colors.text} />
            <Text style={styles.buttonText}>View All Users</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => runDebugCommand(DebugStorage.getCurrentUser, 'Current User')}
            disabled={loading}
          >
            <Ionicons name="person" size={20} color={Colors.text} />
            <Text style={styles.buttonText}>View Current User</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => runDebugCommand(DebugStorage.getUserWatchlist, 'User Watchlist')}
            disabled={loading}
          >
            <Ionicons name="bookmark" size={20} color={Colors.text} />
            <Text style={styles.buttonText}>View Watchlist</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => runDebugCommand(DebugStorage.getUserEpisodeProgress, 'Episode Progress')}
            disabled={loading}
          >
            <Ionicons name="play" size={20} color={Colors.text} />
            <Text style={styles.buttonText}>View Episode Progress</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => runDebugCommand(DebugStorage.getUserShowProgress, 'Show Progress')}
            disabled={loading}
          >
            <Ionicons name="stats-chart" size={20} color={Colors.text} />
            <Text style={styles.buttonText}>View Show Progress</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => runDebugCommand(DebugStorage.getAllStorageKeys, 'All Storage Keys')}
            disabled={loading}
          >
            <Ionicons name="key" size={20} color={Colors.text} />
            <Text style={styles.buttonText}>View All Keys</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => runDebugCommand(DebugStorage.exportAllData, 'Export All Data')}
            disabled={loading}
          >
            <Ionicons name="download" size={20} color={Colors.text} />
            <Text style={styles.buttonText}>Export All Data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={runAllDebug}
            disabled={loading}
          >
            <Ionicons name="bug" size={20} color={Colors.text} />
            <Text style={styles.buttonText}>Run All Debug (Check Console)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.clearOutputButton}
            onPress={clearOutput}
          >
            <Text style={styles.clearOutputButtonText}>Clear Output</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={clearAllData}
          >
            <Text style={styles.dangerButtonText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>

        {output ? (
          <View style={styles.outputContainer}>
            <Text style={styles.outputTitle}>Output:</Text>
            <ScrollView style={styles.outputScroll} nestedScrollEnabled>
              <Text style={styles.outputText}>{output}</Text>
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Storage Information</Text>
          <Text style={styles.infoText}>
            This app uses AsyncStorage (local device storage) instead of a traditional database.
            Data is stored as JSON in the following keys:
          </Text>
          <Text style={styles.infoText}>
            • streamscribe_users - All registered users{'\n'}
            • streamscribe_current_user - Currently logged in user{'\n'}
            • streamscribe_watchlist_[userId] - User's watchlist{'\n'}
            • streamscribe_episodes_progress_[userId] - Episode tracking{'\n'}
            • streamscribe_shows_progress_[userId] - Show progress
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  clearOutputButton: {
    flex: 1,
    backgroundColor: Colors.textMuted,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearOutputButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  dangerButton: {
    flex: 1,
    backgroundColor: Colors.error,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  outputContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  outputTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  outputScroll: {
    maxHeight: 300,
  },
  outputText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  infoContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
});