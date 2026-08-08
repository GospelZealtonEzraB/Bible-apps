import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Alert, Share } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, SectionTitle, EmptyState } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useCircle, useProfile, useStore } from '@/store/useStore';
import { getVerse, normalizeKey, verseId } from '@/data/bibleApi';
import type { CircleGoal, CircleMember, SharedVerseRef } from '@/types';

export default function CircleHubScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const code = typeof params.code === 'string' ? params.code.toUpperCase() : '';

  const circle = useCircle(code);
  const profile = useProfile();
  const syncCircle = useStore((s) => s.syncCircle);
  const refreshCircle = useStore((s) => s.refreshCircle);
  const leaveCircle = useStore((s) => s.leaveCircle);

  const [syncError, setSyncError] = useState<string | null>(null);

  // Push my progress + pull the board whenever the screen focuses.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const run = circle ? syncCircle(code) : refreshCircle(code);
      run.catch((e) => {
        if (active) setSyncError(e instanceof Error ? e.message : 'Could not reach the server.');
      });
      return () => {
        active = false;
      };
    }, [code, circle ? true : false]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onShare = () => {
    Share.share({
      message: `Join our circle "${circle?.meta.name ?? 'Growing Together'}" on Engraved — open the app, go to Together → Join with a code, and enter: ${code}`,
    }).catch(() => {});
  };

  const onLeave = () => {
    Alert.alert('Leave this circle?', 'You can rejoin later with the code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leaveCircle(code);
          router.back();
        },
      },
    ]);
  };

  if (!circle) {
    return (
      <Screen>
        <Header title="Circle" back />
        {syncError ? (
          <EmptyState emoji="📡" title="Couldn’t load this circle" subtitle={syncError} />
        ) : (
          <EmptyState emoji="⏳" title="Loading circle…" subtitle="Fetching the latest from your partner." />
        )}
      </Screen>
    );
  }

  const { meta, members } = circle;

  return (
    <Screen>
      <Header title={meta.name} subtitle={`Invite code · ${meta.code}`} back />

      {syncError ? (
        <Card>
          <Text style={{ color: colors.warning, fontSize: font.sizes.sm }}>
            Showing your last synced view — {syncError}
          </Text>
        </Card>
      ) : null}

      {/* Invite */}
      <Card>
        <SectionTitle>Invite a partner</SectionTitle>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <Text selectable style={{ color: colors.text, fontSize: font.sizes.xl, fontWeight: '800', letterSpacing: 3 }}>
            {meta.code}
          </Text>
          <Button title="Share" small onPress={onShare} icon={<Ionicons name="share-outline" size={16} color={colors.onPrimary} />} />
        </View>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: spacing.sm }}>
          Anyone with this code can join and see the circle’s shared progress.
        </Text>
      </Card>

      {/* Together streak */}
      {meta.togetherStreak > 0 ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ fontSize: 24 }}>🔥</Text>
            <Text style={{ color: colors.text, fontSize: font.sizes.md, fontWeight: '700' }}>
              {meta.togetherStreak}-day together streak
            </Text>
          </View>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: 4 }}>
            Days you’ve all shown up. Keep it going!
          </Text>
        </Card>
      ) : null}

      {/* Covenant */}
      <CovenantCard code={code} />

      {/* Shared goal */}
      <GoalCard code={code} />

      {/* Progress board */}
      <View>
        <SectionTitle>Progress board</SectionTitle>
        <View style={{ gap: spacing.sm }}>
          {members.map((m) => (
            <MemberRow key={m.id} member={m} isMe={m.id === profile.memberId} goal={meta.goal} />
          ))}
        </View>
      </View>

      {/* Shared verses */}
      <SharedVersesCard code={code} members={members} myId={profile.memberId} />

      <View style={{ marginTop: spacing.sm }}>
        <Button title="Leave circle" variant="ghost" onPress={onLeave} />
      </View>
    </Screen>
  );
}

function MemberRow({ member, isMe, goal }: { member: CircleMember; isMe: boolean; goal: CircleGoal | null }) {
  const { colors } = useTheme();
  const initial = (member.displayName || '?').trim().charAt(0).toUpperCase();

  let line = `📖 ${member.memorizedCount} memorized   ·   🔥 ${member.streak}`;
  if (goal?.kind === 'memorizeCount') {
    line = `📖 ${member.memorizedCount} / ${goal.target}   ·   🔥 ${member.streak}`;
  } else if (goal?.kind === 'sharedVerses') {
    line = `🤝 ${member.versesDone.length} / ${goal.target} shared   ·   🔥 ${member.streak}`;
  } else if (goal?.kind === 'streak') {
    line = `🔥 ${member.streak} / ${goal.target}-day streak`;
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.lg }}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>
            {member.displayName || 'Unnamed'}{isMe ? '  (you)' : ''}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>{line}</Text>
        </View>
      </View>
    </Card>
  );
}

const GOAL_KINDS: { kind: CircleGoal['kind']; label: string; hasTarget: boolean }[] = [
  { kind: 'memorizeCount', label: 'Each memorize N', hasTarget: true },
  { kind: 'sharedVerses', label: 'All shared verses', hasTarget: false },
  { kind: 'streak', label: 'N-day streak', hasTarget: true },
];

function GoalCard({ code }: { code: string }) {
  const { colors } = useTheme();
  const circle = useCircle(code);
  const setCircleGoal = useStore((s) => s.setCircleGoal);
  const goal = circle?.meta.goal ?? null;
  const sharedCount = circle?.sharedVerses.length ?? 0;

  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<CircleGoal['kind']>(goal?.kind ?? 'memorizeCount');
  const [target, setTarget] = useState(goal?.target ?? 5);
  const [saving, setSaving] = useState(false);

  const save = async (next: CircleGoal | null) => {
    setSaving(true);
    try {
      await setCircleGoal(code, next);
      setEditing(false);
    } catch (e) {
      Alert.alert('Couldn’t save goal', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onSave = () => {
    const t = kind === 'sharedVerses' ? sharedCount : target;
    const label =
      kind === 'memorizeCount' ? `Each memorize ${t} verses`
      : kind === 'sharedVerses' ? 'Memorize all shared verses'
      : `Reach a ${t}-day streak`;
    save({ kind, target: t, label });
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionTitle style={{ marginBottom: 0 }}>Shared goal</SectionTitle>
        {!editing ? (
          <Button title={goal ? 'Edit' : 'Set'} variant="secondary" small onPress={() => { setKind(goal?.kind ?? 'memorizeCount'); setTarget(goal?.target ?? 5); setEditing(true); }} />
        ) : null}
      </View>

      {editing ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {GOAL_KINDS.map((g) => (
              <Chip key={g.kind} label={g.label} active={kind === g.kind} onPress={() => setKind(g.kind)} />
            ))}
          </View>
          {GOAL_KINDS.find((g) => g.kind === kind)?.hasTarget ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Text style={{ color: colors.textMuted }}>Target</Text>
              <Button title="–" variant="secondary" small onPress={() => setTarget(Math.max(1, target - 1))} />
              <Text style={{ color: colors.text, fontSize: font.sizes.lg, fontWeight: '800', minWidth: 28, textAlign: 'center' }}>{target}</Text>
              <Button title="+" variant="secondary" small onPress={() => setTarget(Math.min(999, target + 1))} />
            </View>
          ) : (
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
              Target = every verse in the shared list ({sharedCount}).
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {goal ? <Button title="Clear" variant="ghost" small style={{ flex: 1 }} onPress={() => save(null)} /> : null}
            <Button title={saving ? 'Saving…' : 'Save goal'} small style={{ flex: 1 }} loading={saving} onPress={onSave} />
          </View>
        </View>
      ) : goal ? (
        <Text style={{ color: colors.text, fontSize: font.sizes.md, fontWeight: '600', marginTop: spacing.sm }}>
          🎯 {goal.label ?? `${goal.kind} · ${goal.target}`}
        </Text>
      ) : (
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm, marginTop: spacing.sm }}>
          Set a goal you’ll reach together.
        </Text>
      )}
    </Card>
  );
}

function SharedVersesCard({ code, members, myId }: { code: string; members: CircleMember[]; myId: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const circle = useCircle(code);
  const addSharedVerse = useStore((s) => s.addSharedVerse);
  const addFetchedVerse = useStore((s) => s.addFetchedVerse);
  const hasVerse = useStore((s) => s.hasVerse);
  const translation = useStore((s) => s.settings.translation);
  const serverUrl = useStore((s) => s.settings.serverUrl);

  const [ref, setRef] = useState('');
  const [forId, setForId] = useState<string | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  const shared = circle?.sharedVerses ?? [];
  const others = members.filter((m) => m.id !== myId);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName ?? 'partner';

  const onAdd = async () => {
    const r = ref.trim();
    if (!r) return;
    setAdding(true);
    try {
      await addSharedVerse(code, r, forId);
      setRef('');
      setForId(undefined);
    } catch (e) {
      Alert.alert('Couldn’t add', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const onImport = async (reference: string) => {
    setImporting(reference);
    try {
      const v = await getVerse(reference, translation, { serverUrl });
      addFetchedVerse(v, `circle:${code}`);
    } catch (e) {
      Alert.alert('Couldn’t add to your library', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setImporting(null);
    }
  };

  return (
    <View>
      <SectionTitle>Shared verses</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md }}>
          <Ionicons name="book-outline" size={18} color={colors.textFaint} />
          <TextInput
            value={ref}
            onChangeText={setRef}
            placeholder="Add a reference (e.g. Philippians 4:6-7)"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={onAdd}
            style={{ flex: 1, color: colors.text, fontSize: font.sizes.md, paddingVertical: spacing.md }}
          />
        </View>
        {others.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' }}>
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>For:</Text>
            <Chip label="Everyone" active={!forId} onPress={() => setForId(undefined)} />
            {others.map((m) => (
              <Chip key={m.id} label={m.displayName || 'partner'} active={forId === m.id} onPress={() => setForId(m.id)} />
            ))}
          </View>
        ) : null}
        <View style={{ marginTop: spacing.md }}>
          <Button title={adding ? 'Adding…' : 'Add to shared list'} onPress={onAdd} loading={adding} disabled={!ref.trim()} />
        </View>
      </Card>

      {shared.length > 0 ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {shared.map((sv) => (
            <SharedVerseRow
              key={normalizeKey(sv.reference)}
              sv={sv}
              forLabel={sv.forMemberId ? (sv.forMemberId === myId ? 'for you' : `for ${nameOf(sv.forMemberId)}`) : null}
              inLibrary={hasVerse(verseId(sv.reference, translation))}
              importing={importing === sv.reference}
              onImport={() => onImport(sv.reference)}
              onOpen={() => router.push(`/verse/${encodeURIComponent(verseId(sv.reference, translation))}`)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SharedVerseRow({
  sv,
  forLabel,
  inLibrary,
  importing,
  onImport,
  onOpen,
}: {
  sv: SharedVerseRef;
  forLabel: string | null;
  inLibrary: boolean;
  importing: boolean;
  onImport: () => void;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>{sv.reference}</Text>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
            added by {sv.addedByName || 'someone'}{forLabel ? ` · ${forLabel}` : ''}
          </Text>
        </View>
        {inLibrary ? (
          <Button title="Open" variant="secondary" small onPress={onOpen} />
        ) : (
          <Button title={importing ? '…' : 'Add to mine'} small loading={importing} onPress={onImport} />
        )}
      </View>
    </Card>
  );
}

function CovenantCard({ code }: { code: string }) {
  const { colors } = useTheme();
  const circle = useCircle(code);
  const setCircleCovenant = useStore((s) => s.setCircleCovenant);
  const covenant = circle?.meta.covenant ?? null;

  const [editing, setEditing] = useState(false);
  const [cadence, setCadence] = useState(covenant?.cadenceLabel ?? '');
  const [goal, setGoal] = useState(covenant?.goalText ?? '');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    try {
      await setCircleCovenant(code, cadence.trim(), goal.trim());
      setEditing(false);
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const has = covenant && (covenant.cadenceLabel || covenant.goalText);

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionTitle style={{ marginBottom: 0 }}>Our covenant</SectionTitle>
        {!editing ? (
          <Button title={has ? 'Edit' : 'Set'} variant="secondary" small onPress={() => { setCadence(covenant?.cadenceLabel ?? ''); setGoal(covenant?.goalText ?? ''); setEditing(true); }} />
        ) : null}
      </View>

      {editing ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <TextInput value={cadence} onChangeText={setCadence} placeholder="Rhythm (e.g. study Sundays)" placeholderTextColor={colors.textFaint} style={fieldStyle(colors)} />
          <TextInput value={goal} onChangeText={setGoal} placeholder="Shared goal (e.g. 2 verses a week)" placeholderTextColor={colors.textFaint} style={fieldStyle(colors)} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => setEditing(false)} />
            <Button title={saving ? 'Saving…' : 'Save'} small style={{ flex: 1 }} loading={saving} onPress={onSave} />
          </View>
        </View>
      ) : has ? (
        <View style={{ marginTop: spacing.sm, gap: 4 }}>
          {covenant?.goalText ? <Text style={{ color: colors.text, fontSize: font.sizes.md, fontWeight: '600' }}>🎯 {covenant.goalText}</Text> : null}
          {covenant?.cadenceLabel ? <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>🗓️ {covenant.cadenceLabel}</Text> : null}
        </View>
      ) : (
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm, marginTop: spacing.sm }}>
          Agree a simple rhythm and goal to hold each other to.
        </Text>
      )}
    </Card>
  );
}

function fieldStyle(colors: ReturnType<typeof useTheme>['colors']) {
  return {
    color: colors.text,
    fontSize: font.sizes.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  } as const;
}
