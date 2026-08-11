import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, SectionTitle, StatusBadge, EmptyState, SpeechBubble } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { Ember, type EmberMood } from '@/components/Ember';
import { HelpButton, EmberTip } from '@/components/EmberGuide';
import { pickEmberLine } from '@/data/emberLines';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStats, useVerseList, useStore, useJournal, useWalk, useActiveReadingPlanId, useReadingPlanProgress } from '@/store/useStore';
import { getReadingPlan } from '@/data/readingPlans';
import { journalStreak } from '@/utils/journal';
import { walkStreak, weekStrip } from '@/utils/dailyWalk';
import { parsePassage } from '@/data/books';
import { isDue } from '@/srs/sm2';
import { levelInfo } from '@/gamification';
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
  excited: "Let's hide His word in our hearts!",
  thinking: 'Let me think about that…',
  waving: 'Hi there — ready to begin?',
  praying: "Let's bring it to Him.",
  reading: "Let's dig in.",
  love: 'So good to grow together.',
};

function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

/** The active reading plan's current day, or a prompt to start one. */
function TodaysReadingCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const activeId = useActiveReadingPlanId();
  const progress = useReadingPlanProgress(activeId ?? undefined);
  const plan = getReadingPlan(activeId);
  const toggleReadingDay = useStore((s) => s.toggleReadingDay);

  if (!plan) {
    return (
      <Card onPress={() => router.push('/plans')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Text style={{ fontSize: 26 }}>📖</Text>
        <View style={{ flex: 1 }}>
          <SectionTitle style={{ marginBottom: 2 }}>Today's reading</SectionTitle>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Start a reading plan</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
      </Card>
    );
  }

  const completed = new Set(progress?.completed ?? []);
  const current = plan.days.findIndex((_, i) => !completed.has(i));
  if (current === -1) return null; // plan complete — nothing due today

  const openPassage = (ref: string) => {
    const p = parsePassage(ref);
    if (p) router.push(`/read/${p.bookNumber}/${p.chapter}`);
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <SectionTitle style={{ marginBottom: 0, flex: 1 }}>Today's reading · Day {current + 1}</SectionTitle>
        <Pressable onPress={() => router.push('/plans')} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.sizes.xs }}>Plan</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {plan.days[current].map((ref) => (
          <Chip key={ref} label={ref} onPress={() => openPassage(ref)} />
        ))}
      </View>
      <Button
        title="Mark today complete"
        small
        icon={<Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
        onPress={() => toggleReadingDay(plan.id, current)}
      />
    </Card>
  );
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

/** The ONE streak — "days with God" from the daily walk — with a week strip and
 *  the memorization goal folded in (replaces three tiles + quests + badges). */
function WalkHeroCard({ memorized, goalPct, reviewsToday, dailyGoal }: { memorized: number; goalPct: number; reviewsToday: number; dailyGoal: number }) {
  const { colors } = useTheme();
  const walk = useWalk();
  const today = dayKey();
  const streak = useMemo(() => walkStreak(walk, today), [walk, today]);
  const strip = useMemo(() => weekStrip(walk, today), [walk, today]);
  const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.xl }}>
            {streak > 0 ? `🔥 ${streak} day${streak === 1 ? '' : 's'} with God` : 'Meet with Him today'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs, marginTop: 2 }}>
            Reading, journaling, reviewing, or any movement of your walk counts.
          </Text>
        </View>
        <ProgressRing progress={goalPct} size={50} stroke={6} color={colors.success} label={`${reviewsToday}/${dailyGoal}`} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {strip.map((d) => {
          const letter = DAY_LETTERS[new Date(d.day + 'T12:00:00').getDay()];
          const isToday = d.day === today;
          return (
            <View key={d.day} style={{ alignItems: 'center', gap: 4 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: d.met ? colors.success : colors.surfaceAlt, borderWidth: isToday && !d.met ? 1.5 : 0, borderColor: colors.primary }}>
                {d.met ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>{letter}</Text>}
              </View>
              {isToday ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary }} /> : <View style={{ height: 4 }} />}
            </View>
          );
        })}
      </View>
      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>🏆 {memorized} memorized</Text>
    </Card>
  );
}

function JournalTodayCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const journal = useJournal();
  const today = dayKey();
  const hasToday = !!journal[today];
  const streak = useMemo(() => journalStreak(journal, today), [journal, today]);

  return (
    <Card onPress={() => router.push('/journal')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="book-outline" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>
          {hasToday ? 'Today’s journal' : 'Journal today'}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
          {streak > 0 ? `${streak}-day streak · what is He showing you?` : 'Record what the Lord is teaching you'}
        </Text>
      </View>
      <Ionicons name={hasToday ? 'checkmark-circle' : 'chevron-forward'} size={20} color={hasToday ? colors.success : colors.textFaint} />
    </Card>
  );
}

function WelcomeBackCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const studySessions = useStore((s) => s.studySessions);
  const applications = useStore((s) => s.applications);
  const lastOpenedDay = useStore((s) => s.session.lastOpenedDay);
  const markOpened = useStore((s) => s.markOpened);
  const revisitApplication = useStore((s) => s.revisitApplication);
  const verses = useVerseList();

  // Capture "were we away?" once on mount, then stamp today.
  const [returning] = useState(() => !!lastOpenedDay && lastOpenedDay !== dayKey());
  useEffect(() => {
    markOpened();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dueCount = useMemo(() => verses.filter((v) => isDue(v.srs)).length, [verses]);
  const lastStudy = useMemo(
    () => Object.values(studySessions).sort((a, b) => b.fetchedAt - a.fetchedAt)[0],
    [studySessions],
  );
  const pendingApp = useMemo(
    () => Object.values(applications).filter((a) => !a.revisitedAt).sort((a, b) => b.createdAt - a.createdAt)[0],
    [applications],
  );

  if (!returning || (!lastStudy && dueCount === 0 && !pendingApp)) return null;

  return (
    <Card>
      <SectionTitle>Welcome back 👋</SectionTitle>
      {lastStudy ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ flex: 1, color: colors.text, fontSize: font.sizes.md }}>
            Last time you studied <Text style={{ fontWeight: '700' }}>{lastStudy.passage}</Text>.
          </Text>
          <Button title="Continue" variant="secondary" small onPress={() => router.push(`/study/${encodeURIComponent(lastStudy.passage)}`)} />
        </View>
      ) : null}
      {pendingApp ? (
        <View style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.text, fontSize: font.sizes.md }}>
            How did living out <Text style={{ fontWeight: '700' }}>{pendingApp.passage}</Text> go?
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, fontStyle: 'italic', marginTop: 2 }}>“{pendingApp.text}”</Text>
          <View style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}>
            <Button title="It went well 🙌" variant="ghost" small onPress={() => revisitApplication(pendingApp.passageKey, 'Went well')} />
          </View>
        </View>
      ) : null}
      {dueCount > 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <Button title={`Review ${dueCount} verse${dueCount === 1 ? '' : 's'} due`} onPress={() => router.push('/review')} />
        </View>
      ) : null}
    </Card>
  );
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const stats = useStats();
  const verses = useVerseList();
  const verseCount = useStore((s) => Object.keys(s.verses).length);
  const [emberPop, setEmberPop] = useState(0);

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
      <Header title="Today" subtitle={today} right={<HelpButton topic="today" />} />

      <EmberTip topic="today" />

      {/* Ember hero */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable onPress={() => setEmberPop((n) => n + 1)} hitSlop={8}>
          <Ember mood={mood} size={84} react={emberPop} />
        </Pressable>
        <View style={{ flex: 1, gap: 8 }}>
          <SpeechBubble>{emberPop > 0 ? pickEmberLine('greeting', emberPop) : MOOD_SPEECH[mood]}</SpeechBubble>
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

      {/* Begin Abide — the guided quiet time */}
      <Card onPress={() => router.push('/abide')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.primarySoft, borderColor: colors.primary }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sunny-outline" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.md }}>Begin Abide</Text>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>A quiet time: be still, read, hide His Word</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.primary} />
      </Card>

      {/* Journal today — the journaling core */}
      <JournalTodayCard />

      {/* Welcome-back recap */}
      <WelcomeBackCard />

      {/* Today's reading (active plan) */}
      <TodaysReadingCard />

      {/* The one streak — days with God (walk + week strip), replacing the
          stat-tile trio and the quests card (de-gimmick: one habit, one number). */}
      <WalkHeroCard memorized={memorized} goalPct={goalPct} reviewsToday={stats.reviewsToday} dailyGoal={stats.dailyGoal} />

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
