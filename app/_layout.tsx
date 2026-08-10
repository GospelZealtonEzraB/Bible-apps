import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { View, AppState } from 'react-native';

import { useTheme } from '@/theme';
import { configureNotificationHandler } from '@/notifications';
import { Celebration } from '@/components/Celebration';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { VersePeekProvider } from '@/components/PeekableRef';
import { useStore, useSettings } from '@/store/useStore';

// Never let startup config throw before the app can render.
try {
  configureNotificationHandler();
} catch {
  // notifications are optional; ignore setup failures
}

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

/** The navigable app — kept below the ErrorBoundary so any failure here (the
 *  onboarding gate, hydration, or a screen) becomes a recoverable screen. */
function AppShell() {
  const { colors, dark } = useTheme();
  useOnboardingGate();

  const hydrated = useStore((s) => s.hydrated);

  // Once hydrated, fold any legacy private notes into the unified Doc model.
  useEffect(() => {
    if (hydrated) useStore.getState().runNotesMigration();
  }, [hydrated]);

  // Auto-save a cloud backup (keyed by the transfer id) whenever the app is
  // backgrounded, so a new phone with the same code restores everything.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        useStore.getState().cloudBackup().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <VersePeekProvider>
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
      </VersePeekProvider>
      <Celebration />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AppShell />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
