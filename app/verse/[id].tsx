import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';

import { Screen, Header } from '@/components/layout';
import { Card, StatusBadge, Button, SectionTitle, EmptyState } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { VerseNotes } from '@/components/VerseNotes';
import { VerseCircleNotes } from '@/components/VerseCircleNotes';
import { CrossRefs } from '@/components/CrossRefs';
import { RefText } from '@/components/RefText';
import { useTheme, spacing, font, radius } from '@/theme';
import { useVerse, useStore, useSettings } from '@/store/useStore';
import { isLatinTranslation } from '@/data/bibleApi';
import { fetchMemoryHook, fetchExplanation } from '@/data/aiClient';
import { resolveServerUrl } from '@/config';
import { relativeDueLabel } from '@/utils/date';
import type { DrillMode } from '@/types';

const DRILLS: { mode: DrillMode; emoji: string; title: string; desc: string }[] = [
  { mode: 'flashcard', emoji: '🃏', title: 'Flashcards', desc: 'Flip reference and verse' },
  { mode: 'vanish', emoji: '🌫️', title: 'Vanishing Words', desc: 'Fade words away, pass by pass' },
  { mode: 'firstletter', emoji: '🔤', title: 'First Letters', desc: 'Recall from first letters only' },
  { mode: 'blank', emoji: '⌨️', title: 'Fill & Type', desc: 'Fill blanks or type it out' },
  { mode: 'choice', emoji: '🧠', title: 'Multiple Choice', desc: 'Pick the right words fast' },
  { mode: 'speed', emoji: '⚡', title: 'Speed Round', desc: 'Beat the clock, word by word' },
];

export default function VerseDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? decodeURIComponent(params.id) : '';
  const verse = useVerse(id);
  const serverUrl = useSettings((s) => s.serverUrl);
  const aiEnabled = !!resolveServerUrl(serverUrl);
  const setVerseAi = useStore((s) => s.setVerseAi);
  const [speaking, setSpeaking] = useState(false);
  const [aiLoading, setAiLoading] = useState<null | 'hook' | 'explain'>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const runHook = async () => {
    if (!verse || verse.memoryHook) return;
    setAiLoading('hook');
    setAiError(null);
    try {
      const text = await fetchMemoryHook(serverUrl, verse);
      setVerseAi(verse.id, { memoryHook: text });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Failed to generate.');
    } finally {
      setAiLoading(null);
    }
  };

  const runExplain = async () => {
    if (!verse || verse.explanation) return;
    setAiLoading('explain');
    setAiError(null);
    try {
      const text = await fetchExplanation(serverUrl, verse);
      setVerseAi(verse.id, { explanation: text });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Failed to generate.');
    } finally {
      setAiLoading(null);
    }
  };

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
            fontFamily: isLatinTranslation(verse.translation) ? font.serif : undefined,
          }}
        >
          "{verse.text}"
        </Text>

        {verse.translation === 'esv' ? (
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: spacing.sm }}>
            Scripture quotations are from the ESV® Bible, © Crossway.
          </Text>
        ) : null}

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

      <CrossRefs reference={verse.reference} />

      <VerseNotes reference={verse.reference} />

      <VerseCircleNotes reference={verse.reference} />

      {/* AI insights */}
      <View>
        <SectionTitle>Go deeper</SectionTitle>
        {!aiEnabled ? (
          <Card>
            <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
              Add your Server URL in Settings to unlock AI memory hooks and plain-English
              explanations for any verse.
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <Button
                title="Open Settings"
                variant="secondary"
                onPress={() => router.push('/settings')}
              />
            </View>
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                title="Memory hook"
                variant="secondary"
                style={{ flex: 1 }}
                loading={aiLoading === 'hook'}
                disabled={aiLoading !== null || !!verse.memoryHook}
                icon={<Ionicons name="sparkles" size={16} color={colors.text} />}
                onPress={runHook}
              />
              <Button
                title="Explain"
                variant="secondary"
                style={{ flex: 1 }}
                loading={aiLoading === 'explain'}
                disabled={aiLoading !== null || !!verse.explanation}
                icon={<Ionicons name="bulb" size={16} color={colors.text} />}
                onPress={runExplain}
              />
            </View>

            {aiError ? <Text style={{ color: colors.danger }}>{aiError}</Text> : null}

            {verse.memoryHook ? (
              <Card style={{ gap: 4 }}>
                <Text style={{ color: colors.accent, fontWeight: '800', fontSize: font.sizes.xs }}>
                  ✨ MEMORY HOOK
                </Text>
                <RefText text={verse.memoryHook} style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24 }} />
              </Card>
            ) : null}

            {verse.explanation ? (
              <Card style={{ gap: 4 }}>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.xs }}>
                  💡 MEANING & CONTEXT
                </Text>
                <RefText text={verse.explanation} style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24 }} />
              </Card>
            ) : null}
          </View>
        )}
      </View>

      <View>
        <SectionTitle>Ways to learn it</SectionTitle>
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
