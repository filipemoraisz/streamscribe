import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS, View, StyleSheet } from 'react-native';
import { ConnectionStatusIndicator } from '../../components/ConnectionStatusIndicator';
import { useRealTimeStatus } from '../../components/hooks/useRealTimeStatus';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const realTimeStatus = useRealTimeStatus();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Connection Status Header */}
      <View style={[styles.statusHeader, { paddingTop: insets.top }]}>
        <ConnectionStatusIndicator
          isConnected={realTimeStatus.isConnected}
          isConnecting={realTimeStatus.isConnecting}
          showLabel={true}
        />
      </View>

      <NativeTabs
        labelStyle={{
          color: DynamicColorIOS({
            dark: 'white',
            light: 'black',
          }),
        }}
        tintColor={DynamicColorIOS({
          dark: 'white',
          light: 'black',
        })}
      >
        <NativeTabs.Trigger name="index">
          <Label>Home</Label>
          <Icon sf="house.fill" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="watchlist">
          <Label>Watchlist</Label>
          <Icon sf="bookmark.fill" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <Label>Profile</Label>
          <Icon sf="person.crop.circle" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="search" role="search">
          <Label>Search</Label>
          <Icon sf="magnifyingglass" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="optimizer">
          <Label>Calendar</Label>
          <Icon sf="calendar" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusHeader: {
    position: 'absolute',
    top: 0,
    right: 16,
    zIndex: 1000,
    backgroundColor: 'transparent',
  },
});