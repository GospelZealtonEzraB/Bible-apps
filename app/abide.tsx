import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, SectionTitle, SpeechBubble } from '@/components/ui';
import { Ember } from '@/components/Ember';
import { EmberTip } from '@/components/EmberGuide';
import { useTheme, spacing, font, radius } from '@/theme';
import { useVerseList, useActiveReadingPlanId, useReadingPlanProgress, useSettings, useStore, useWalk } from '@/store/useStore';
import { getReadingPlan } from '@/data/readingPlans';
import { parsePassage } from '@/data/books';
import { isDue } from '@/srs/sm2';
import { dayKey } from '@/utils/date';
import { rhythmProgress, walkStreak } from '@/utils/dailyWalk';

// Gentle, unattributed prompts to still the heart before the Word.
const PRESENCE_PROMPTS = [
  'Lord, quiet my heart. Open my eyes to see wonderful things in Your Word.',
  'Holy Spirit, be my teacher today — lead me into all truth.',
  'Speak, Lord; Your servant is listening.',
  'Father, I come not just to read, but to meet with You. Draw near.',
  'Still me, Lord. Let me wait on You before I begin.',
];

interface MovementDef {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// The movement library — the believer assembles their own rhythm from these.
const MOVEMENTS: MovementDef[] = [
  { key: 'come', title: 'Come — be still', icon: 'sparkles-outline' },
  { key: 'worship', title: 'Worship — sing', icon: 'musical-notes-outline' },
  { key: 'word', title: 'The Word — read', icon: 'book-outline' },
  { key: 'deeper', title: 'Go deeper — study', icon: 'search-outline' },
  { key: 'teaching', title: 'Teaching — sit under it', icon: 'mic-outline' },
  { key: 'respond', title: 'Hide it — memorize & review', icon: 'heart-outline' },
  { key: 'close', title: 'Respond & close', icon: 'leaf-outline' },
];
const DEFAULT_RHYTHM = ['come', 'worship', 'word', 'deeper', 'respond', 'close'];
const movementOf = (key: string) => MOVEMENTS.find((m) => m.key === key);

function Shell({ icon, color, title, done, onToggle, children }: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; done: boolean; onToggle: () => void; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: spacing.sm, opacity: done ? 0.75 : 1, borderColor: done ? colors.success : colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <SectionTitle style={{ marginBottom: 0, flex: 1 }}>{title}</SectionTitle>
        {/* The tracked loop: tap to record the movement — it feeds the one streak. */}
        <Pressable onPress={onToggle} hitSlop={10}>
          <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={done ? colors.success : colors.textFaint} />
        </Pressable>
      </View>
      {children}
    </Card>
  );
}

export default function AbideScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const verses = useVerseList();
  const activeId = useActiveReadingPlanId();
  const progress = useReadingPlanProgress(activeId ?? undefined);
  const plan = getReadingPlan(activeId);
  const rhythm = useSettings((s) => s.abideRhythm) ?? DEFAULT_RHYTHM;
  const setSettings = useStore((s) => s.setSettings);
  const completeWalkMovement = useStore((s) => s.completeWalkMovement);
  const uncompleteWalkMovement = useStore((s) => s.uncompleteWalkMovement);
  const walk = useWalk();
  const [editing, setEditing] = useState(false);

  const today = dayKey();
  const progressToday = rhythmProgress(walk, today, rhythm);
  const streak = walkStreak(walk, today);
  const doneSet = new Set(progressToday.doneKeys);
  const allDone = progressToday.total > 0 && progressToday.done === progressToday.total;
  const toggleDone = (key: string) =>
    doneSet.has(key) ? uncompleteWalkMovement(key, today) : completeWalkMovement(key, today);

  const due = verses.filter((v) => isDue(v.srs)).length;
  const prompt = PRESENCE_PROMPTS[new Date().getDate() % PRESENCE_PROMPTS.length];

  let todaysPassages: string[] = [];
  if (plan) {
    const done = new Set(progress?.completed ?? []);
    const current = plan.days.findIndex((_, i) => !done.has(i));
    if (current !== -1) todaysPassages = plan.days[current];
  }

  const openPassage = (ref: string) => {
    const p = parsePassage(ref);
    if (p) router.push(`/read/${p.bookNumber}/${p.chapter}`);
  };

  const toggle = (key: string) =>
    setSettings({ abideRhythm: rhythm.includes(key) ? rhythm.filter((k) => k !== key) : [...rhythm, key] });
  const move = (key: string, dir: -1 | 1) => {
    const i = rhythm.indexOf(key);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= rhythm.length) return;
    const next = [...rhythm];
    [next[i], next[j]] = [next[j], next[i]];
    setSettings({ abideRhythm: next });
  };

  const body = (key: string) => {
    switch (key) {
      case 'come':
        return <Text style={{ color: colors.text, fontSize: font.sizes.md, fontFamily: font.serif, fontStyle: 'italic', lineHeight: 26 }}>"{prompt}"</Text>;
      case 'worship':
        return <Button title="Sing a hymn" variant="secondary" small icon={<Ionicons name="musical-notes" size={16} color={colors.text} />} onPress={() => router.push('/hymns')} />;
      case 'word':
        return todaysPassages.length > 0 ? (
          <>
            <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>Today's reading</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {todaysPassages.map((ref) => <Chip key={ref} label={ref} onPress={() => openPassage(ref)} />)}
            </View>
          </>
        ) : (
          <Button title="Open the Bible" variant="secondary" small icon={<Ionicons name="book" size={16} color={colors.text} />} onPress={() => router.push('/read')} />
        );
      case 'deeper':
        return <Button title="Study the passage" variant="secondary" small icon={<Ionicons name="sparkles" size={16} color={colors.text} />} onPress={() => router.push('/study')} />;
      case 'teaching':
        return <Button title="A message or devotional" variant="secondary" small icon={<Ionicons name="mic" size={16} color={colors.text} />} onPress={() => router.push('/sermon')} />;
      case 'respond':
        return due > 0 ? (
          <Button title={`Review ${due} verse${due === 1 ? '' : 's'}`} small icon={<Ionicons name="play" size={16} color={colors.onPrimary} />} onPress={() => router.push('/review')} />
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>All caught up on review. Pick a verse from today's reading to hide in your heart.</Text>
        );
      case 'close':
        return <Text style={{ color: colors.textMuted, fontSize: font.sizes.md, lineHeight: 24 }}>Name one way you'll live this out today — then close in prayer, thanking Him for meeting you.</Text>;
      default:
        return null;
    }
  };

  const iconColor = (key: string) => (key === 'word' || key === 'teaching' ? colors.accent : key === 'respond' ? colors.success : colors.primary);

  return (
    <Screen>
      <Header
        title="Abide"
        subtitle="A quiet time, at your pace"
        back
        right={
          <Pressable onPress={() => setEditing((e) => !e)} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: editing ? colors.primarySoft : colors.surfaceAlt }}>
            <Ionicons name={editing ? 'checkmark' : 'options-outline'} size={16} color={editing ? colors.primary : colors.text} />
            <Text style={{ color: editing ? colors.primary : colors.text, fontWeight: '800', fontSize: font.sizes.sm }}>{editing ? 'Done' : 'Rhythm'}</Text>
          </Pressable>
        }
      />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Ember mood={allDone ? 'celebrating' : 'praying'} size={64} />
        <SpeechBubble>
          {allDone
            ? 'You met with Him today. Carry it with you. 🌟'
            : 'Unhurried is the pace. Linger where He leads — skip what you need to.'}
        </SpeechBubble>
      </Card>

      {/* Today's walk — the tracked loop feeding the one streak */}
      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>
            Today’s walk · {progressToday.done}/{progressToday.total}
          </Text>
          {streak > 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, fontWeight: '700' }}>🔥 {streak} day{streak === 1 ? '' : 's'} with God</Text>
          ) : null}
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
          <View style={{ width: `${progressToday.total ? Math.round((progressToday.done / progressToday.total) * 100) : 0}%`, height: 8, backgroundColor: allDone ? colors.success : colors.primary }} />
        </View>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
          Check off each movement as you go — any one of them makes today count.
        </Text>
      </Card>

      <EmberTip topic="today" id="abide" />

      {editing ? (
        <Card style={{ gap: spacing.md }}>
          <SectionTitle style={{ marginBottom: 0 }}>Build your rhythm</SectionTitle>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>Your quiet time, your order. Toggle movements on or off and reorder them.</Text>
          {rhythm.map((key, i) => {
            const mv = movementOf(key);
            if (!mv) return null;
            return (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name={mv.icon} size={18} color={colors.primary} />
                <Text style={{ flex: 1, color: colors.text, fontSize: font.sizes.md, fontWeight: '600' }}>{mv.title}</Text>
                {i > 0 ? <Pressable onPress={() => move(key, -1)} hitSlop={6}><Ionicons name="arrow-up" size={18} color={colors.textFaint} /></Pressable> : null}
                {i < rhythm.length - 1 ? <Pressable onPress={() => move(key, 1)} hitSlop={6}><Ionicons name="arrow-down" size={18} color={colors.textFaint} /></Pressable> : null}
                <Pressable onPress={() => toggle(key)} hitSlop={6}><Ionicons name="remove-circle-outline" size={18} color={colors.textFaint} /></Pressable>
              </View>
            );
          })}
          {MOVEMENTS.filter((m) => !rhythm.includes(m.key)).length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>ADD A MOVEMENT</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {MOVEMENTS.filter((m) => !rhythm.includes(m.key)).map((m) => (
                  <Chip key={m.key} label={`＋ ${m.title.split(' — ')[0]}`} onPress={() => toggle(m.key)} />
                ))}
              </View>
            </View>
          ) : null}
          <Button title="Reset to the gentle default" variant="ghost" small onPress={() => setSettings({ abideRhythm: DEFAULT_RHYTHM })} />
        </Card>
      ) : (
        <>
          {rhythm.map((key) => {
            const mv = movementOf(key);
            if (!mv) return null;
            return (
              <Shell key={key} icon={mv.icon} color={iconColor(key)} title={mv.title} done={doneSet.has(key)} onToggle={() => toggleDone(key)}>
                {body(key)}
              </Shell>
            );
          })}
          <Button
            title={allDone ? 'Amen — you met with Him today 🌟' : 'Amen — done for now'}
            variant={allDone ? 'primary' : 'secondary'}
            onPress={() => router.back()}
          />
        </>
      )}
    </Screen>
  );
}
