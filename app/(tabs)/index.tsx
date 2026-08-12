import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle, EmptyState } from '@/components/ui';
import { LogEntryRow } from '@/components/LogEntryRow';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore, useLogDay, useVerseList, useCircleList, useProfile } from '@/store/useStore';
import { isDue } from '@/srs/sm2';
import { dayKey, prettyDay } from '@/utils/date';
import { publicEntriesForDay } from '@/utils/log';

/**
 * Today — deliberately small.
 *
 * What you did with God today, what's due for review, and whether your partner
 * has met with Him yet. Nothing else: no dashboard, no streaks, no quests. The
 * log is the record; everything that fills it lives on the other tabs.
 */
export default function TodayScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const today = dayKey();

  const entries = useLogDay(today);
  const verses = useVerseList();
  const circles = useCircleList();
  const profile = useProfile();
  const addLogEntry = useStore((s) => s.addLogEntry);
  const syncCircle = useStore((s) => s.syncCircle);

  const [line, setLine] = useState('');
  const [writing, setWriting] = useState(false);

  const due = useMemo(() => verses.filter((v) => isDue(v.srs)).length, [verses]);
  const partner = usePartnerToday(circles, profile.memberId);

  // Keep the partner's presence fresh when this screen comes forward.
  useFocusEffect(
    React.useCallback(() => {
      for (const c of circles) void syncCircle(c.meta?.code ?? '').catch(() => {});
    }, [circles.length]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const saveLine = () => {
    const text = line.trim();
    if (!text) return;
    addLogEntry({ kind: 'text', text });
    setLine('');
    setWriting(false);
  };

  return (
    <Screen>
      <Header
        title="Today"
        subtitle={prettyDay(today)}
        right={
          <Pressable
            onPress={() => router.push('/log')}
            hitSlop={12}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}
          >
            <Ionicons name="calendar-outline" size={15} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.sm }}>My log</Text>
          </Pressable>
        }
      />

      {/* Due for review — the one nudge that earns its place. */}
      {due > 0 ? (
        <Pressable onPress={() => router.push('/practice')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: colors.primary, borderWidth: 1 }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="repeat" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>
                {due} verse{due === 1 ? '' : 's'} ready for review
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>A few minutes keeps them yours.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
          </Card>
        </Pressable>
      ) : null}

      {/* Partner presence — one quiet line, never a comparison. */}
      {partner ? (
        <Pressable onPress={() => router.push('/chat')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16 }}>{partner.metToday ? '🌿' : '🕯️'}</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, flex: 1 }}>
              {partner.metToday
                ? `${partner.name} has been with Him today.`
                : `${partner.name} hasn’t opened today yet.`}
            </Text>
            <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.textFaint} />
          </Card>
        </Pressable>
      ) : null}

      {/* The day itself */}
      <View>
        <SectionTitle>What I did with Him today</SectionTitle>
        {entries.length === 0 ? (
          <Card>
            <EmptyState
              emoji="📖"
              title="Nothing logged yet"
              subtitle="Read, study, sing, write, or memorize — then tap “Add to my log” and it lands here."
              action={<Button title="Open the Bible" onPress={() => router.push('/read')} />}
            />
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {entries.map((e) => (
              <LogEntryRow key={e.id} entry={e} />
            ))}
          </View>
        )}
      </View>

      {/* A line of your own */}
      {writing ? (
        <Card style={{ gap: spacing.sm }}>
          <TextInput
            value={line}
            onChangeText={setLine}
            placeholder="A line about today — what He showed you…"
            placeholderTextColor={colors.textFaint}
            multiline
            autoFocus
            textAlignVertical="top"
            style={{ color: colors.text, fontSize: font.sizes.md, minHeight: 72, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => { setLine(''); setWriting(false); }} />
            <Button title="Add to log" small style={{ flex: 1 }} disabled={!line.trim()} onPress={saveLine} />
          </View>
        </Card>
      ) : (
        <Button
          title="Add a line to today"
          variant="secondary"
          icon={<Ionicons name="add" size={18} color={colors.text} />}
          onPress={() => setWriting(true)}
        />
      )}
    </Screen>
  );
}

/**
 * Has the partner logged anything today? Read straight off the cached snapshot
 * — presence should never block on the network.
 */
function usePartnerToday(
  circles: ReturnType<typeof useCircleList>,
  myId: string,
): { name: string; metToday: boolean } | null {
  return useMemo(() => {
    const today = dayKey();
    for (const c of circles) {
      const other = (c.members ?? []).find((m) => m.id !== myId);
      if (!other) continue;
      const theirLog = c.logs?.[other.id] ?? {};
      const metToday =
        publicEntriesForDay(theirLog, today).length > 0 || other.lastActiveDay === today;
      return { name: other.displayName || 'Your partner', metToday };
    }
    return null;
  }, [circles, myId]);
}
