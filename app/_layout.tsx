import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { configureNotificationHandler } from '@/notifications';
import { Celebration } from '@/components/Celebration';
import { useStore, useSettings } from '@/store/useStore';

configureNotificationHandler();

/** Redirect to the one-time onboarding flow until it's been completed. */
function useOnboardingGate() {
  const router = useRouter();
  const segments = useSegments();
  // Wait until the root navigator is actually mounted before navigating —
  // redirecting too early throws "navigate before mounting the Root Layout".
  const navReady = !!useRootNavigationState()?.key;
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useSettings((s) => s.onboarded);

  useEffect(() => {
    if (!navReady || !hydrated) return;
    const onOnboarding = segments[0] === 'onboarding';
    if (!onboarded && !onOnboarding) {
      router.replace('/onboarding');
    } else if (onboarded && onOnboarding) {
      router.replace('/(tabs)');
    }
  }, [navReady, hydrated, onboarded, segments, router]);
}

export default function RootLayout() {
  const { colors, dark } = useTheme();
  useOnboardingGate();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <StatusBar style={dark ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen
              name="review"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="drill/[id]/[mode]"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </Stack>
          <Celebration />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
