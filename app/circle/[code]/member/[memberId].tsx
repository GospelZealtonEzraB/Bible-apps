import React, { useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle, EmptyState } from '@/components/ui';
import { usePaged, PageMore } from '@/components/Paginated';
import { useTheme, spacing, font } from '@/theme';
import { useCircle, useProfile, useStore } from '@/store/useStore';
import { getVerse, verseId, normalizeKey } from '@/data/bibleApi';
import { relativeTimeAgo } from '@/utils/date';
import { levelInfo } from '@/gamification';
import { learnFromThem } from '@/utils/circleProgress';

const ACT: Record<string, { emoji: string; verb: string }> = {
  memorized: { emoji: '🎉', verb: 'memorized' },
  reviewed: { emoji: '🔁', verb: 'reviewed' },
  added: { emoji: '➕', verb: 'added' },
  studied: { emoji: '📖', verb: 'studied' },
  prayed: { emoji: '🙏', verb: 'prayed' },
  challenge: { emoji: '💪', verb: 'took a challenge on' },
  read: { emoji: '📖', verb: 'read' },
  noted: { emoji: '📝', verb: 'shared a note on' },
};

export default function MemberDetailScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code: string; memberId: string }>();
  const code = typeof params.code === 'string' ? params.code.toUpperCase() : '';
  const memberId = typeof params.memberId === 'string' ? params.memberId : '';

  const circle = useCircle(code);
  const profile = useProfile();
  const cheerMember = useStore((s) => s.cheerMember);

  const member = (circle?.members ?? []).find((m) => m.id === memberId);
  const isMe = memberId === profile.memberId;

  if (!member) {
    return (
      <Screen>
        <Header title="Member" back />
        <EmptyState emoji="🔎" title="Not found" subtitle="This member may have left, or the circle hasn’t synced yet." />
      </Screen>
    );
  }

  const level = levelInfo(member.xp ?? 0);
  const memorized = member.memorizedRefs ?? [];
  const learning = member.learningRefs ?? [];
  const shares = memorized.length > 0 || learning.length > 0;

  // "Learn from them": their memorized verses I don't have in my library yet.
  const myVerses = useStore((s) => s.verses);
  const myKeys = useMemo(() => new Set(Object.values(myVerses).map((v) => normalizeKey(v.reference))), [myVerses]);
  const learnNext = useMemo(() => (isMe ? [] : learnFromThem(memorized, myKeys)), [isMe, memorized, myKeys]);

  return (
    <Screen>
      <Header title={member.displayName || 'Member'} subtitle={isMe ? 'You' : `In your circle`} back />

      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          <Stat value={member.memorizedCount} label="memorized" />
          <Stat value={member.streak} label="🔥 streak" />
          <Stat value={member.bestStreak ?? 0} label="best streak" />
          <Stat value={`Lv ${level.level}`} label={`${member.xp ?? 0} XP`} />
        </View>
        {member.lastActiveDay ? (
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: spacing.md }}>
            Last active {member.lastActiveDay}
          </Text>
        ) : null}
        {!isMe ? (
          <View style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}>
            <Button title="👏 Cheer them on" variant="secondary" small onPress={() => cheerMember(code, member.id).catch(() => {})} />
          </View>
        ) : null}
      </Card>

      {!shares ? (
        <Card>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
            {isMe
              ? 'Turn on “Share my library” in Settings to let your circle see which verses you’ve memorized.'
              : `${member.displayName || 'This partner'} is keeping their verse list private.`}
          </Text>
        </Card>
      ) : null}

      {learnNext.length > 0 ? (
        <View>
          <Card style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text style={{ fontSize: 22 }}>🌱</Text>
            <Text style={{ flex: 1, color: colors.text, fontSize: font.sizes.sm, lineHeight: 21 }}>
              {member.displayName || 'Your partner'} knows {learnNext.length} verse{learnNext.length === 1 ? '' : 's'} you don’t have yet. Learn from them.
            </Text>
          </Card>
          <RefList code={code} title={`Learn from ${member.displayName || 'them'}`} refs={learnNext} />
        </View>
      ) : null}

      {memorized.length > 0 ? (
        <RefList code={code} title={`Memorized (${memorized.length})`} refs={memorized} />
      ) : null}

      {learning.length > 0 ? (
        <RefList code={code} title={`Currently learning (${learning.length})`} refs={learning} muted />
      ) : null}

      {member.recentActivity && member.recentActivity.length > 0 ? (
        <View>
          <SectionTitle>Recent activity</SectionTitle>
          <Card>
            {[...member.recentActivity].reverse().map((a, i) => {
              const meta = ACT[a.type] ?? { emoji: '•', verb: a.type };
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 15 }}>{meta.emoji}</Text>
                  <Text style={{ flex: 1, color: colors.text, fontSize: font.sizes.sm }}>{meta.verb}{a.ref ? ` ${a.ref}` : ''}</Text>
                  <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{relativeTimeAgo(a.at)}</Text>
                </View>
              );
            })}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', minWidth: 64 }}>
      <Text style={{ color: colors.text, fontSize: font.sizes.xl, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs }}>{label}</Text>
    </View>
  );
}

function RefList({ code, title, refs, muted }: { code: string; title: string; refs: string[]; muted?: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const addFetchedVerse = useStore((s) => s.addFetchedVerse);
  const hasVerse = useStore((s) => s.hasVerse);
  const translation = useStore((s) => s.settings.translation);
  const serverUrl = useStore((s) => s.settings.serverUrl);
  const [importing, setImporting] = useState<string | null>(null);
  const page = usePaged(refs, 20, refs.length);

  const onImport = async (reference: string) => {
    setImporting(reference);
    try {
      const v = await getVerse(reference, translation, { serverUrl });
      addFetchedVerse(v, `circle:${code}`);
    } catch (e) {
      Alert.alert('Couldn’t add', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setImporting(null);
    }
  };

  return (
    <View>
      <SectionTitle>{title}</SectionTitle>
      <Card>
        {page.shown.map((r) => {
          const mine = hasVerse(verseId(r, translation));
          return (
            <View key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 }}>
              <Ionicons name={muted ? 'ellipse-outline' : 'checkmark-circle'} size={16} color={muted ? colors.textFaint : colors.success} />
              <Text style={{ flex: 1, color: colors.text, fontSize: font.sizes.sm, fontWeight: '600' }}>{r}</Text>
              {mine ? (
                <Button title="Open" variant="ghost" small onPress={() => router.push(`/verse/${encodeURIComponent(verseId(r, translation))}`)} />
              ) : (
                <Button title={importing === r ? '…' : 'Add to mine'} small loading={importing === r} onPress={() => onImport(r)} />
              )}
            </View>
          );
        })}
        <PageMore remaining={page.remaining} step={20} onPress={page.showMore} noun="more" />
      </Card>
    </View>
  );
}
