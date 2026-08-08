import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Alert, Share } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle, EmptyState } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useCircle, useProfile, useStore } from '@/store/useStore';
import type { CircleMember } from '@/types';

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

      {/* Progress board */}
      <View>
        <SectionTitle>Progress board</SectionTitle>
        <View style={{ gap: spacing.sm }}>
          {members.map((m) => (
            <MemberRow key={m.id} member={m} isMe={m.id === profile.memberId} goalTarget={meta.goal && meta.goal.kind === 'memorizeCount' ? meta.goal.target : undefined} />
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.sm }}>
        <Button title="Leave circle" variant="ghost" onPress={onLeave} />
      </View>
    </Screen>
  );
}

function MemberRow({ member, isMe, goalTarget }: { member: CircleMember; isMe: boolean; goalTarget?: number }) {
  const { colors } = useTheme();
  const initial = (member.displayName || '?').trim().charAt(0).toUpperCase();
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
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
            📖 {member.memorizedCount} memorized{goalTarget ? ` / ${goalTarget}` : ''}   ·   🔥 {member.streak}
          </Text>
        </View>
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
