import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle, StatusBadge, EmptyState } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { Ember, type EmberMood } from '@/components/Ember';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStats, useVerseList, useStore } from '@/store/useStore';
import { isDue } from '@/srs/sm2';
import { levelInfo, BADGES } from '@/gamification';
import { dayKey } from '@/utils/date';
import { WEB_FIXTURES } from '@/data/fixtures';
import { normalizeKey } from '@/data/bibleApi';
import { VERSE_OF_THE_DAY_POOL } from '@/data/packs';
import type { Verse } from '@/types';

const MOOD_SPEECH: Record<EmberMood, string> = {
  content: 'Ready when you are.',
  celebrating: "You showed up today — love it!",
  proud: "All caught up. You're on fire.",
  worried: "Don't leave me hanging — keep the streak!",
  sleeping: 'See you tomorrow.',
};

function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

function StatTile({
  value,
  label,
  emoji,
}: {
  value: string;
  label: string;
  emoji: string;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.md }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={{ color: colors.text, fontSize: font.sizes.xl, fontWeight: '800' }}>
        {value}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs }}>{label}</Text>
    </Card>
  );
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const stats = useStats();
  const verses = useVerseList();
  const verseCount = useStore((s) => Object.keys(s.verses).length);

  const due = useMemo(() => verses.filter((v) => isDue(v.srs)), [verses]);
  const memorized = useMemo(
    () => verses.filter((v) => v.status === 'memorized').length,
    [verses],
  );
  const learning = useMemo(
    () => verses.filter((v) => v.status === 'new' || v.status === 'learning').slice(0, 3),
    [verses],
  );

  const votdRef = VERSE_OF_THE_DAY_POOL[dayOfYear() % VERSE_OF_THE_DAY_POOL.length];
  const votdText = WEB_FIXTURES[normalizeKey(votdRef)];
  const goalPct = stats.dailyGoal > 0 ? (stats.reviewsToday / stats.dailyGoal) * 100 : 0;

  const activeToday = stats.lastActiveDay === dayKey();
  const level = levelInfo(stats.xp);
  let mood: EmberMood = 'content';
  if (verseCount > 0 && stats.streak > 0 && !activeToday) mood = 'worried';
  else if (activeToday) mood = 'celebrating';
  else if (verseCount > 0 && due.length === 0) mood = 'proud';

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Screen>
      <Header title="Today" subtitle={today} />

      {/* Ember hero */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Ember mood={mood} size={80} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text
            style={{
              color: colors.text,
              fontSize: font.sizes.md,
              fontFamily: font.serif,
              fontStyle: 'italic',
            }}
          >
            “{MOOD_SPEECH[mood]}”
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>Level {level.level}</Text>
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
              {level.inLevel}/{level.perLevel} XP
            </Text>
          </View>
          <View style={{ height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
            <View
              style={{
                width: `${level.progress}%`,
                height: 8,
                backgroundColor: colors.accent,
                borderRadius: 4,
              }}
            />
          </View>
        </View>
      </Card>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StatTile emoji="🔥" value={String(stats.streak)} label="day streak" />
        <StatTile emoji="🏆" value={String(memorized)} label="memorized" />
        <Card style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.md }}>
          <ProgressRing
            progress={goalPct}
            size={54}
            stroke={6}
            color={colors.success}
            label={`${stats.reviewsToday}/${stats.dailyGoal}`}
          />
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs, marginTop: 4 }}>
            today's goal
          </Text>
        </Card>
      </View>

      {/* Review CTA */}
      {verseCount === 0 ? (
        <Card>
          <EmptyState
            emoji="🌱"
            title="Start hiding the Word in your heart"
            subtitle="Add your first verse or grab a starter pack to begin memorizing."
            action={<Button title="Add a verse" onPress={() => router.push('/add')} />}
          />
        </Card>
      ) : due.length > 0 ? (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary }}>
          <SectionTitle style={{ color: colors.primary }}>Review queue</SectionTitle>
          <Text
            style={{
              color: colors.text,
              fontSize: font.sizes.lg,
              fontWeight: '700',
              marginBottom: spacing.md,
            }}
          >
            {due.length} verse{due.length === 1 ? '' : 's'} ready for review
          </Text>
          <Button
            title="Start review"
            icon={<Ionicons name="play" size={18} color={colors.onPrimary} />}
            onPress={() => router.push('/review')}
          />
        </Card>
      ) : (
        <Card style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 34 }}>✅</Text>
          <Text style={{ color: colors.text, fontSize: font.sizes.lg, fontWeight: '700' }}>
            All caught up!
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>
            No verses due right now. Practice a verse or add a new one.
          </Text>
        </Card>
      )}

      {/* Verse of the day */}
      {votdText ? (
        <View>
          <SectionTitle>Verse of the day</SectionTitle>
          <Card>
            <Text
              style={{
                color: colors.text,
                fontSize: font.sizes.lg,
                lineHeight: 28,
                fontFamily: font.serif,
              }}
            >
              "{votdText}"
            </Text>
            <Text
              style={{
                color: colors.primary,
                fontWeight: '700',
                marginTop: spacing.md,
              }}
            >
              {votdRef}
            </Text>
          </Card>
        </View>
      ) : null}

      {/* Achievements */}
      {verseCount > 0 ? (
        <View>
          <SectionTitle>
            Achievements · {(stats.earnedBadges ?? []).length}/{BADGES.length}
          </SectionTitle>
          <Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {BADGES.map((b) => {
                const earned = (stats.earnedBadges ?? []).includes(b.id);
                return (
                  <View key={b.id} style={{ alignItems: 'center', width: 84, opacity: earned ? 1 : 0.35 }}>
                    <Text style={{ fontSize: 28 }}>{earned ? b.emoji : '🔒'}</Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: colors.textMuted, fontSize: font.sizes.xs, marginTop: 2 }}
                    >
                      {b.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>
        </View>
      ) : null}

      {/* Continue learning */}
      {learning.length > 0 ? (
        <View>
          <SectionTitle>Continue learning</SectionTitle>
          <View style={{ gap: spacing.sm }}>
            {learning.map((v) => (
              <VerseRow key={v.id} verse={v} onPress={() => router.push(`/verse/${encodeURIComponent(v.id)}`)} />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function VerseRow({ verse, onPress }: { verse: Verse; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={{ paddingVertical: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <ProgressRing progress={verse.mastery} size={44} stroke={5} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>
            {verse.reference}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
            {verse.text}
          </Text>
          <View style={{ marginTop: 6 }}>
            <StatusBadge status={verse.status} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </View>
    </Card>
  );
}
