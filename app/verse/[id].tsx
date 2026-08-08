import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';

import { Screen, Header } from '@/components/layout';
import { Card, StatusBadge, Button, SectionTitle, EmptyState } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { useTheme, spacing, font, radius } from '@/theme';
import { useVerse } from '@/store/useStore';
import { relativeDueLabel } from '@/utils/date';
import type { DrillMode } from '@/types';

const DRILLS: { mode: DrillMode; emoji: string; title: string; desc: string }[] = [
  { mode: 'flashcard', emoji: '🃏', title: 'Flashcards', desc: 'Flip reference and verse' },
  { mode: 'vanish', emoji: '🌫️', title: 'Vanishing Words', desc: 'Fade words away, pass by pass' },
  { mode: 'firstletter', emoji: '🔤', title: 'First Letters', desc: 'Recall from first letters only' },
  { mode: 'blank', emoji: '⌨️', title: 'Fill & Type', desc: 'Fill blanks or type it out' },
];

export default function VerseDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? decodeURIComponent(params.id) : '';
  const verse = useVerse(id);
  const [speaking, setSpeaking] = useState(false);

  if (!verse) {
    return (
      <Screen>
        <Header title="Verse" back />
        <EmptyState emoji="🔎" title="Verse not found" subtitle="It may have been removed." />
      </Screen>
    );
  }

  const toggleSpeak = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    Speech.speak(`${verse.text}. ${verse.reference}`, {
      rate: 0.92,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  return (
    <Screen>
      <Header
        title={verse.reference}
        subtitle={verse.translationName ?? verse.translation.toUpperCase()}
        back
      />

      <Card>
        <Text
          style={{
            color: colors.text,
            fontSize: font.sizes.xl,
            lineHeight: 34,
            fontFamily: font.serif,
          }}
        >
          "{verse.text}"
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.lg,
            marginTop: spacing.lg,
            paddingTop: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <ProgressRing progress={verse.mastery} size={64} label={`${verse.mastery}%`} sublabel="mastery" />
          <View style={{ flex: 1, gap: 6 }}>
            <StatusBadge status={verse.status} />
            <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
              {relativeDueLabel(verse.srs.dueDate)}
            </Text>
            <Pressable
              onPress={toggleSpeak}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                alignSelf: 'flex-start',
                marginTop: 4,
                paddingVertical: 6,
                paddingHorizontal: spacing.md,
                borderRadius: radius.pill,
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <Ionicons
                name={speaking ? 'stop' : 'volume-high'}
                size={16}
                color={colors.primary}
              />
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: font.sizes.sm }}>
                {speaking ? 'Stop' : 'Listen'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Card>

      <View>
        <SectionTitle>Practice</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {DRILLS.map((d) => (
            <Pressable
              key={d.mode}
              onPress={() =>
                router.push(`/drill/${encodeURIComponent(verse.id)}/${d.mode}`)
              }
              style={{
                width: '47%',
                flexGrow: 1,
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.lg,
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 26 }}>{d.emoji}</Text>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>
                {d.title}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs }}>{d.desc}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Button
        title="Quick self-review"
        variant="secondary"
        icon={<Ionicons name="repeat" size={18} color={colors.text} />}
        onPress={() => router.push(`/drill/${encodeURIComponent(verse.id)}/flashcard`)}
      />
    </Screen>
  );
}
