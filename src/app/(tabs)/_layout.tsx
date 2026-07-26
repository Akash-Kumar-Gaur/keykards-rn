/**
 * Bottom-tab navigator using the custom floating pill tab bar.
 * 5 tabs: Home, Vault, Track, Assist (AI Assistant), Profile.
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '@/components/FloatingTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...(props as any)} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="vault" options={{ title: 'Vault' }} />
      <Tabs.Screen name="track" options={{ title: 'Track' }} />
      <Tabs.Screen name="assistant" options={{ title: 'Assist' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
