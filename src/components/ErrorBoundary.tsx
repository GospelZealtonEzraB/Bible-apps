import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// expo-updates is only present in real builds; load it defensively so the
// recovery screen itself can never crash for lack of it.
let Updates: typeof import('expo-updates') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Updates = require('expo-updates');
} catch {
  Updates = null;
}

// Hardcoded palette — the recovery screen must not depend on the theme/store,
// which may be the very thing that failed.
const BG = '#0B1220';
const CARD = '#141E3A';
const TEXT = '#EAF0FF';
const MUTED = '#9AA7C7';
const ACCENT = '#F5A623';
const PRIMARY = '#7C9CF5';

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Catches any render/effect error anywhere below it and shows a friendly,
 * self-contained recovery screen instead of a hard crash ("app stopped
 * working"). Offers a safe retry and a last-resort data reset. Also surfaces
 * the error text so a crash can be diagnosed from a screenshot.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch() {
    // Intentionally no-op; the message is shown on-screen for diagnosis.
  }

  private reload = async () => {
    try {
      if (Updates && typeof Updates.reloadAsync === 'function') {
        await Updates.reloadAsync();
        return;
      }
    } catch {
      // fall through
    }
    // Fallback when a native reload isn't available: clear the boundary and
    // let the tree re-render.
    this.setState({ error: null });
  };

  private tryAgain = () => this.setState({ error: null });

  private resetData = async () => {
    try {
      await AsyncStorage.clear();
    } catch {
      // ignore — still attempt a reload
    }
    await this.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={{ flex: 1, backgroundColor: BG, padding: 24, justifyContent: 'center' }}>
        <View style={{ backgroundColor: CARD, borderRadius: 20, padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 44, textAlign: 'center' }}>🕊️</Text>
          <Text style={{ color: TEXT, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
            Something went sideways
          </Text>
          <Text style={{ color: MUTED, fontSize: 15, textAlign: 'center', lineHeight: 21 }}>
            Your saved verses and progress are safe. Try again — and if it keeps happening, a reset
            usually clears it.
          </Text>

          <Pressable
            onPress={this.tryAgain}
            style={{ backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#0B1220', fontWeight: '800', fontSize: 16 }}>Try again</Text>
          </Pressable>

          <Pressable onPress={this.resetData} style={{ paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ color: ACCENT, fontWeight: '700', fontSize: 14 }}>Reset & restart</Text>
          </Pressable>

          <ScrollView style={{ maxHeight: 120 }}>
            <Text style={{ color: MUTED, fontSize: 11, fontFamily: 'monospace' }}>
              {String(error?.message ?? error)}
            </Text>
          </ScrollView>
        </View>
      </View>
    );
  }
}
