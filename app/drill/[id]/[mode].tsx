import React, { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Button, EmptyState } from '@/components/ui';
import { useTheme, spacing, font } from '@/theme';
import { useVerse, useStore } from '@/store/useStore';
import {
  FlashcardDrill,
  VanishingDrill,
  FirstLetterDrill,
  BlankDrill,
  type DrillProps,
} from '@/components/drills';
import type { DrillMode } from '@/types';

const TITLES: Record<DrillMode, string> = {
  flashcard: 'Flashcards',
  vanish: 'Vanishing Words',
  firstletter: 'First Letters',
  blank: 'Fill & Type',
};

function celebrate(accuracy: number) {
  if (Platform.OS === 'web') return;
  try {
    if (accuracy >= 90) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Haptics unavailable on this device — ignore.
  }
}

export default function DrillScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; mode: string }>();
  const id = typeof params.id === 'string' ? decodeURIComponent(params.id) : '';
  const mode = params.mode as DrillMode;
  const verse = useVerse(id);
  const practiceResult = useStore((s) => s.practiceResult);

  const [runKey, setRunKey] = useState(0);
  const [done, setDone] = useState<number | null>(null);

  const close = () => router.back();

  if (!verse) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <EmptyState emoji="🔎" title="Verse not found" action={<Button title="Close" onPress={close} />} />
      </SafeAreaView>
    );
  }

  const onComplete = (accuracy: number) => {
    practiceResult(verse.id, accuracy);
    celebrate(accuracy);
    setDone(accuracy);
  };

  const drillProps: DrillProps = { verse, onComplete };

  const renderDrill = () => {
    switch (mode) {
      case 'flashcard':
        return <FlashcardDrill key={runKey} {...drillProps} />;
      case 'vanish':
        return <VanishingDrill key={runKey} {...drillProps} />;
      case 'firstletter':
        return <FirstLetterDrill key={runKey} {...drillProps} />;
      case 'blank':
        return <BlankDrill key={runKey} {...drillProps} />;
      default:
        return <FlashcardDrill key={runKey} {...drillProps} />;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        <View>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs, fontWeight: '700' }}>
            {TITLES[mode] ?? 'Practice'}
          </Text>
          <Text style={{ color: colors.text, fontSize: font.sizes.lg, fontWeight: '800' }}>
            {verse.reference}
          </Text>
        </View>
        <Pressable onPress={close} hitSlop={12}>
          <Ionicons name="close" size={28} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
        {done === null ? (
          renderDrill()
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
            <EmptyState
              emoji={done >= 90 ? '🎉' : done >= 60 ? '💪' : '🌱'}
              title={done >= 90 ? 'Beautifully done!' : done >= 60 ? 'Getting there!' : 'Keep going!'}
              subtitle={
                done >= 90
                  ? "That's hidden deep in your heart now."
                  : 'Repetition is the secret. Run it again.'
              }
            />
            <View style={{ gap: spacing.sm }}>
              <Button
                title="Practice again"
                icon={<Ionicons name="refresh" size={18} color={colors.onPrimary} />}
                onPress={() => {
                  setDone(null);
                  setRunKey((k) => k + 1);
                }}
              />
              <Button title="Back to verse" variant="secondary" onPress={close} />
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
