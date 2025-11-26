import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS } from 'react-native';

export default function TabLayout() {
  return (
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
  );
}