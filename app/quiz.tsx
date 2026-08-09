import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, EmptyState } from '@/components/ui';
import { Ember } from '@/components/Ember';
import { ChoiceDrill, SpeedDrill } from '@/components/drills';
import { useTheme, spacing, font, radius } from '@/theme';
import { useVerseList, useStore } from '@/store/useStore';
import { eligibleQuizVerses, sampleVerses, QUIZ_MIN } from '@/utils/quiz';
import { hydrateReference } from '@/data/localSearch';
import { POPULAR_VERSES } from '@/data/popularVerses';
import { initialSRS } from '@/srs/sm2';
import type { Verse } from '@/types';

const QUESTION_COUNT = 10;
type Source = 'mine' | 'explore';

/** Build quiz-ready pseudo-verses from popular references (bundled KJV text). */
function explorePool(): Verse[] {
  const now = 0;
  return POPULAR_VERSES.map((ref) => {
    const hit = hydrateReference(ref);
    if (!hit) return null;
    return { id: `quiz:${ref}`, reference: hit.reference, text: hit.text, translation: 'kjv', status: 'learning', srs: initialSRS(now), mastery: 0, dateAdded: now } as Verse;
  }).filter((v): v is Verse => !!v);
}

export default function QuizScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const verses = useVerseList();
  const practiceResult = useStore((s) => s.practiceResult);

  const minePool = eligibleQuizVerses(verses);
  const [phase, setPhase] = useState<'start' | 'playing' | 'done'>('start');
  const [source, setSource] = useState<Source>('mine');
  const [timed, setTimed] = useState(false);
  const [questions, setQuestions] = useState<Verse[]>([]);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);

  const mineReady = minePool.length >= QUIZ_MIN;
  const activePool = source === 'mine' ? minePool : explorePool();

  const start = () => {
    if (source === 'mine' && !mineReady) return;
    setQuestions(sampleVerses(activePool, QUESTION_COUNT));
    setIndex(0);
    setCorrect(0);
    setPhase('playing');
  };

  const onAnswer = (accuracy: number) => {
    const v = questions[index];
    // Only feed the spaced-repetition schedule for the user's own verses.
    if (v && source === 'mine') practiceResult(v.id, accuracy);
    if (accuracy >= 90) setCorrect((c) => c + 1);
    if (index + 1 >= questions.length) setPhase('done');
    else setIndex((i) => i + 1);
  };

  if (phase === 'start') {
    return (
      <Screen>
        <Header title="Quiz" subtitle="Identify verses by their text" back />

        <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 4 }}>
          {(['mine', 'explore'] as Source[]).map((s) => (
            <Pressable key={s} onPress={() => setSource(s)} style={{ flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: source === s ? colors.surface : 'transparent', alignItems: 'center' }}>
              <Text style={{ color: source === s ? colors.primary : colors.textMuted, fontWeight: '800', fontSize: font.sizes.sm }}>
                {s === 'mine' ? 'My verses' : 'Explore'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Card style={{ alignItems: 'center', gap: spacing.md }}>
          <Ember mood="excited" size={80} />
          <Text style={{ color: colors.text, fontSize: font.sizes.md, textAlign: 'center', lineHeight: 24 }}>
            {source === 'mine'
              ? `Pick the right reference for verses from your own library (the reference is hidden).`
              : `Test yourself on well-known verses across the whole Bible — beyond what you've memorized.`}
          </Text>
          <Pressable onPress={() => setTimed((t) => !t)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: timed ? colors.primarySoft : colors.surfaceAlt }}>
            <Ionicons name={timed ? 'flash' : 'flash-outline'} size={18} color={timed ? colors.primary : colors.textMuted} />
            <Text style={{ color: timed ? colors.primary : colors.textMuted, fontWeight: '700' }}>Timed (Speed Round){timed ? ' · on' : ''}</Text>
          </Pressable>
        </Card>

        {source === 'mine' && !mineReady ? (
          <EmptyState emoji="🎯" title="Not enough saved verses yet" subtitle={`Save and start learning at least ${QUIZ_MIN} verses to quiz your own library — or switch to Explore.`} action={<Button title="Add verses" onPress={() => router.push('/add')} />} />
        ) : (
          <Button title="Start quiz" icon={<Ionicons name="play" size={18} color={colors.onPrimary} />} onPress={start} />
        )}
      </Screen>
    );
  }

  if (phase === 'done') {
    const total = questions.length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    return (
      <Screen>
        <Header title="Quiz" back />
        <Card style={{ alignItems: 'center', gap: spacing.sm }}>
          <Ember mood={pct >= 80 ? 'celebrating' : pct >= 50 ? 'proud' : 'content'} size={110} />
          <Text style={{ color: colors.text, fontSize: font.sizes.xxl, fontWeight: '800' }}>{correct}/{total}</Text>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.md }}>{pct}% correct · {source === 'mine' ? 'your verses' : 'explore'}</Text>
        </Card>
        <Button title="Quiz again" icon={<Ionicons name="refresh" size={18} color={colors.onPrimary} />} onPress={start} />
        <Button title="Done" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  // playing
  const verse = questions[index];
  return (
    <Screen scroll={false}>
      <Header title={`Question ${index + 1} of ${questions.length}`} subtitle={`✓ ${correct} correct`} back />
      <View style={{ flex: 1 }}>
        {timed ? (
          <SpeedDrill key={index} verse={verse} onComplete={onAnswer} />
        ) : (
          <ChoiceDrill key={index} verse={verse} onComplete={onAnswer} />
        )}
      </View>
    </Screen>
  );
}
