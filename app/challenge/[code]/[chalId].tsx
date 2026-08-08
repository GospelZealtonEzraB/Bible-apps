import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle, EmptyState } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useCircle, useStore } from '@/store/useStore';
import { getVerse } from '@/data/bibleApi';
import { diffWords } from '@/drills/helpers';
import type { ChallengeKind } from '@/types';

const PROMPTS: Record<ChallengeKind, { title: string; placeholder: string; scored: boolean }> = {
  recite: { title: 'Recite it from memory', placeholder: 'Type the verse from memory…', scored: true },
  type: { title: 'Type it from memory', placeholder: 'Type the verse from memory…', scored: true },
  fill: { title: 'Write it out', placeholder: 'Type the verse…', scored: true },
  reflection: { title: 'Reflect', placeholder: 'What does this passage mean to you?', scored: false },
  application: { title: 'Apply it', placeholder: 'How will you live this out this week?', scored: false },
  study: { title: 'Study insight', placeholder: 'Share one insight from studying this passage.', scored: false },
};

export default function ChallengeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; chalId: string }>();
  const code = typeof params.code === 'string' ? params.code.toUpperCase() : '';
  const chalId = typeof params.chalId === 'string' ? params.chalId : '';

  const circle = useCircle(code);
  const submitChallenge = useStore((s) => s.submitChallenge);
  const translation = useStore((s) => s.settings.translation);
  const serverUrl = useStore((s) => s.settings.serverUrl);

  const challenge = (circle?.challenges ?? []).find((c) => c.chalId === chalId);
  const prompt = challenge ? PROMPTS[challenge.kind] : PROMPTS.type;

  const [expected, setExpected] = useState<string | null>(null);
  const [loadingVerse, setLoadingVerse] = useState(false);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!challenge || !prompt.scored) return;
    let active = true;
    setLoadingVerse(true);
    getVerse(challenge.reference, translation, { serverUrl })
      .then((v) => active && setExpected(v.text))
      .catch(() => active && setExpected(null)) // offline: submit without a score
      .finally(() => active && setLoadingVerse(false));
    return () => {
      active = false;
    };
  }, [challenge?.reference, prompt.scored]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!challenge) {
    return (
      <Screen>
        <Header title="Challenge" back />
        <EmptyState emoji="🔎" title="Challenge not found" subtitle="It may have been removed, or the circle hasn’t synced yet." />
      </Screen>
    );
  }

  const onSubmit = async () => {
    if (!answer.trim()) return;
    setSubmitting(true);
    try {
      const accuracy = prompt.scored && expected ? diffWords(expected, answer).accuracy : undefined;
      await submitChallenge(code, chalId, answer.trim(), accuracy);
      Alert.alert(
        'Sent to your partner 💛',
        accuracy != null ? `You matched ${accuracy}% of the words. ${challenge.fromName} will review it.` : `${challenge.fromName} will see your response.`,
      );
      router.back();
    } catch (e) {
      Alert.alert('Couldn’t submit', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Header title={prompt.title} subtitle={`${challenge.reference} · from ${challenge.fromName}`} back />

      <Card>
        <SectionTitle>{challenge.reference}</SectionTitle>
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
          {prompt.scored
            ? 'Recite it from memory — you’ll get a word-match score, and your partner will encourage you.'
            : 'Take a moment and respond honestly. Your partner will read it.'}
        </Text>
        {prompt.scored && loadingVerse ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>Loading the verse for scoring…</Text>
          </View>
        ) : null}
        {prompt.scored && !loadingVerse && !expected ? (
          <Text style={{ color: colors.warning, fontSize: font.sizes.xs, marginTop: spacing.sm }}>
            Couldn’t load the verse to score — you can still submit; your partner will review it.
          </Text>
        ) : null}
      </Card>

      <Card>
        <TextInput
          value={answer}
          onChangeText={setAnswer}
          placeholder={prompt.placeholder}
          placeholderTextColor={colors.textFaint}
          multiline
          textAlignVertical="top"
          style={{
            color: colors.text,
            fontSize: font.sizes.md,
            lineHeight: 24,
            minHeight: 140,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            padding: spacing.md,
          }}
        />
        <View style={{ marginTop: spacing.md }}>
          <Button title={submitting ? 'Sending…' : 'Send to partner'} onPress={onSubmit} loading={submitting} disabled={!answer.trim()} />
        </View>
      </Card>
    </Screen>
  );
}
