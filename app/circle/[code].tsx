import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Alert, Share, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, SectionTitle, EmptyState, SpeechBubble } from '@/components/ui';
import { Ember } from '@/components/Ember';
import { pickEmberLine } from '@/data/emberLines';
import { useTheme, spacing, font, radius } from '@/theme';
import { useCircle, useProfile, useStore } from '@/store/useStore';
import { getVerse, normalizeKey, verseId } from '@/data/bibleApi';
import { dayKey, daysBetweenKeys, relativeTimeAgo } from '@/utils/date';
import { PLAN_TEMPLATES } from '@/data/plans';
import { levelInfo } from '@/gamification';
import { togetherTotals, coverage, mergeActivity } from '@/utils/circleProgress';
import { EXPECTED_API_VERSION } from '@/data/circleClient';
import type { Challenge, ChallengeKind, CircleGoal, CircleMember, Prayer, SharedVerseRef, StudyPlan } from '@/types';

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
  const cheerMember = useStore((s) => s.cheerMember);
  const setCircleName = useStore((s) => s.setCircleName);

  const [syncError, setSyncError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState('');

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
      message: `Join our circle "${circle?.meta.name ?? 'Growing Together'}" on Versed — open the app, go to Together → Join with a code, and enter: ${code}`,
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
      <Header
        title={meta.name}
        subtitle={`Invite code · ${meta.code}`}
        back
        right={
          <Pressable onPress={() => { setNameInput(meta.name); setRenaming(true); }} hitSlop={8}>
            <Ionicons name="pencil" size={18} color={colors.textMuted} />
          </Pressable>
        }
      />

      {renaming ? (
        <Card>
          <SectionTitle>Rename circle</SectionTitle>
          <TextInput value={nameInput} onChangeText={setNameInput} placeholder="Circle name" placeholderTextColor={colors.textFaint} autoFocus style={fieldStyle(colors)} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => setRenaming(false)} />
            <Button title="Save" small style={{ flex: 1 }} disabled={!nameInput.trim()} onPress={async () => { try { await setCircleName(code, nameInput); } catch {} setRenaming(false); }} />
          </View>
        </Card>
      ) : null}

      {circle.apiVersion !== undefined && circle.apiVersion < EXPECTED_API_VERSION ? (
        <Card style={{ borderColor: colors.warning }}>
          <Text style={{ color: colors.warning, fontWeight: '700', fontSize: font.sizes.sm }}>
            Your circle server is out of date
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginTop: 2 }}>
            Some features (prayer, notes, plans) need a newer server. Ask the circle owner to redeploy it:
            {' '}<Text style={{ fontWeight: '700' }}>cd server && npx wrangler deploy</Text>.
          </Text>
        </Card>
      ) : null}

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

      {/* Quiet-partner nudge */}
      <QuietPartnerNudge members={members} myId={profile.memberId} />

      {/* Accountability inbox */}
      <ChallengesCard code={code} members={members} myId={profile.memberId} />

      {/* Covenant */}
      <CovenantCard code={code} />

      {/* Shared goal */}
      <GoalCard code={code} />

      {/* Together stats */}
      <TogetherStatsCard members={members} togetherStreak={meta.togetherStreak} />

      {/* Progress board */}
      <View>
        <SectionTitle>How we're growing</SectionTitle>
        <View style={{ gap: spacing.sm }}>
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isMe={m.id === profile.memberId}
              goal={meta.goal}
              cheers={circle.cheersFor?.[m.id] ?? 0}
              onOpen={() => router.push(`/circle/${code}/member/${m.id}`)}
              onCheer={m.id !== profile.memberId ? () => cheerMember(code, m.id).catch(() => {}) : undefined}
            />
          ))}
        </View>
      </View>

      {/* Who knows what */}
      <WhoKnowsWhatCard members={members} myId={profile.memberId} />

      {/* Activity feed */}
      <ActivityFeedCard members={members} myId={profile.memberId} />

      {/* Shared verses */}
      <SharedVersesCard code={code} members={members} myId={profile.memberId} />

      {/* Study plans */}
      <PlansCard code={code} />

      {/* Prayer wall */}
      <PrayerCard code={code} myId={profile.memberId} />

      {/* Notes wall */}
      <NotesCard code={code} myId={profile.memberId} />

      <View style={{ marginTop: spacing.sm }}>
        <Button title="Leave circle" variant="ghost" onPress={onLeave} />
      </View>
    </Screen>
  );
}

function MemberRow({
  member,
  isMe,
  goal,
  cheers,
  onOpen,
  onCheer,
}: {
  member: CircleMember;
  isMe: boolean;
  goal: CircleGoal | null;
  cheers: number;
  onOpen?: () => void;
  onCheer?: () => void;
}) {
  const { colors } = useTheme();
  const initial = (member.displayName || '?').trim().charAt(0).toUpperCase();
  const level = levelInfo(member.xp ?? 0);

  let line = `📖 ${member.memorizedCount} memorized   ·   🔥 ${member.streak}`;
  if (goal?.kind === 'memorizeCount') {
    line = `📖 ${member.memorizedCount} / ${goal.target}   ·   🔥 ${member.streak}`;
  } else if (goal?.kind === 'sharedVerses') {
    line = `🤝 ${member.versesDone.length} / ${goal.target} shared   ·   🔥 ${member.streak}`;
  } else if (goal?.kind === 'streak') {
    line = `🔥 ${member.streak} / ${goal.target}-day streak`;
  }

  return (
    <Card onPress={onOpen}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.lg }}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>
            {member.displayName || 'Unnamed'}{isMe ? '  (you)' : ''}
            <Text style={{ color: colors.textFaint, fontWeight: '600', fontSize: font.sizes.xs }}>{`   Lv ${level.level}`}</Text>
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>{line}</Text>
        </View>
        {onCheer ? (
          <Pressable onPress={onCheer} hitSlop={8} style={{ alignItems: 'center', paddingHorizontal: spacing.sm }}>
            <Text style={{ fontSize: 20 }}>👏</Text>
            {cheers > 0 ? <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{cheers}</Text> : null}
          </Pressable>
        ) : cheers > 0 ? (
          <View style={{ alignItems: 'center', paddingHorizontal: spacing.sm }}>
            <Text style={{ fontSize: 18 }}>👏</Text>
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{cheers}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </View>
    </Card>
  );
}

const ACTIVITY_META: Record<string, { emoji: string; verb: string }> = {
  memorized: { emoji: '🎉', verb: 'memorized' },
  reviewed: { emoji: '🔁', verb: 'reviewed' },
  added: { emoji: '➕', verb: 'added' },
  studied: { emoji: '📖', verb: 'studied' },
  prayed: { emoji: '🙏', verb: 'prayed' },
  challenge: { emoji: '💪', verb: 'took a challenge on' },
};

function TogetherStatsCard({ members, togetherStreak }: { members: CircleMember[]; togetherStreak: number }) {
  const { colors } = useTheme();
  const totals = useMemo(() => togetherTotals(members), [members]);
  const Stat = ({ value, label }: { value: string | number; label: string }) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: colors.text, fontSize: font.sizes.xl, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs, textAlign: 'center' }}>{label}</Text>
    </View>
  );
  return (
    <Card>
      <SectionTitle>Together so far</SectionTitle>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Stat value={totals.combinedUnique} label={'verses hidden\nin your hearts'} />
        <Stat value={totals.common} label={'you all know\nin common'} />
        <Stat value={togetherStreak} label={'day together\nstreak'} />
      </View>
    </Card>
  );
}

function WhoKnowsWhatCard({ members, myId }: { members: CircleMember[]; myId: string }) {
  const { colors } = useTheme();
  const rows = useMemo(() => coverage(members), [members]);
  const [open, setOpen] = useState(false);
  const shared = members.some((m) => (m.memorizedRefs?.length ?? 0) > 0);

  if (!shared) {
    return (
      <View>
        <SectionTitle>Verses between us</SectionTitle>
        <Card>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm }}>
            As you and your circle memorize verses, you’ll see who knows what here.
          </Text>
        </Card>
      </View>
    );
  }

  const shown = open ? rows : rows.slice(0, 6);

  return (
    <View>
      <SectionTitle>Who knows what</SectionTitle>
      <Card>
        {shown.map((r) => {
          const everyone = r.byMemberIds.length === members.length && members.length > 1;
          return (
            <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 }}>
              <Text style={{ flex: 1, color: colors.text, fontSize: font.sizes.sm, fontWeight: everyone ? '800' : '600' }}>
                {everyone ? '🌟 ' : ''}{r.display}
              </Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {members.map((m) => {
                  const has = r.byMemberIds.includes(m.id);
                  return (
                    <View key={m.id} style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: has ? colors.success : colors.surfaceAlt }}>
                      <Text style={{ color: has ? '#fff' : colors.textFaint, fontSize: 10, fontWeight: '800' }}>
                        {(m.displayName || '?').trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
        {rows.length > 6 ? (
          <View style={{ marginTop: spacing.sm }}>
            <Button title={open ? 'Show less' : `Show all ${rows.length}`} variant="ghost" small onPress={() => setOpen((o) => !o)} />
          </View>
        ) : null}
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: spacing.sm }}>
          🌟 = everyone knows it. A single initial = a verse only one of you has (a great one to share).
        </Text>
      </Card>
    </View>
  );
}

function ActivityFeedCard({ members, myId }: { members: CircleMember[]; myId: string }) {
  const { colors } = useTheme();
  const feed = useMemo(() => mergeActivity(members, 15), [members]);
  if (feed.length === 0) return null;
  return (
    <View>
      <SectionTitle>Lately</SectionTitle>
      <Card>
        {feed.map((f, i) => {
          const meta = ACTIVITY_META[f.type] ?? { emoji: '•', verb: f.type };
          const who = f.memberId === myId ? 'You' : f.name || 'Someone';
          return (
            <View key={`${f.memberId}-${f.at}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 }}>
              <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
              <Text style={{ flex: 1, color: colors.text, fontSize: font.sizes.sm }}>
                <Text style={{ fontWeight: '800' }}>{who}</Text> {meta.verb}{f.ref ? ` ${f.ref}` : ''}
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{relativeTimeAgo(f.at)}</Text>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

function PlansCard({ code }: { code: string }) {
  const { colors } = useTheme();
  const circle = useCircle(code);
  const createCirclePlan = useStore((s) => s.createCirclePlan);
  const plans = circle?.plans ?? [];
  const [mode, setMode] = useState<'idle' | 'templates' | 'custom'>('idle');
  const [busy, setBusy] = useState<string | null>(null);

  // custom builder state
  const [title, setTitle] = useState('');
  const [refInput, setRefInput] = useState('');
  const [items, setItems] = useState<string[]>([]);

  const start = async (planTitle: string, planItems: string[]) => {
    if (!planTitle.trim() || planItems.length === 0) return;
    setBusy(planTitle);
    try {
      await createCirclePlan(code, planTitle.trim(), planItems);
      setMode('idle');
      setTitle('');
      setItems([]);
    } catch (e) {
      Alert.alert('Couldn’t start plan', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const addRef = () => {
    const r = refInput.trim();
    if (!r) return;
    setItems((prev) => (prev.includes(r) ? prev : [...prev, r]));
    setRefInput('');
  };

  return (
    <View>
      <SectionTitle>Plans we're walking</SectionTitle>
      {plans.map((p) => (
        <PlanRow key={p.planId} plan={p} circleCode={code} />
      ))}

      {mode === 'templates' ? (
        <Card>
          <SectionTitle>Start from a collection</SectionTitle>
          <View style={{ gap: spacing.sm }}>
            {PLAN_TEMPLATES.map((t) => (
              <Card key={t.id} onPress={() => start(t.title, t.items)}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>{t.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>{t.description} · {t.items.length} verses</Text>
                {busy === t.title ? <Text style={{ color: colors.primary, fontSize: font.sizes.xs, marginTop: 4 }}>Starting…</Text> : null}
              </Card>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => setMode('idle')} />
            <Button title="＋ Build my own" small style={{ flex: 1 }} onPress={() => setMode('custom')} />
          </View>
        </Card>
      ) : mode === 'custom' ? (
        <Card>
          <SectionTitle>Build your own plan</SectionTitle>
          <TextInput value={title} onChangeText={setTitle} placeholder="Plan name (e.g. Verses on hope)" placeholderTextColor={colors.textFaint} style={fieldStyle(colors)} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <TextInput value={refInput} onChangeText={setRefInput} placeholder="Add a reference (e.g. Psalm 46:1)" placeholderTextColor={colors.textFaint} autoCapitalize="words" returnKeyType="done" onSubmitEditing={addRef} style={[fieldStyle(colors), { flex: 1 }]} />
            <Button title="Add" small onPress={addRef} disabled={!refInput.trim()} />
          </View>
          {items.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
              {items.map((r) => (
                <Pressable key={r} onPress={() => setItems((prev) => prev.filter((x) => x !== r))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
                  <Text style={{ color: colors.text, fontSize: font.sizes.sm, fontWeight: '600' }}>{r}</Text>
                  <Ionicons name="close" size={13} color={colors.textFaint} />
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => setMode('idle')} />
            <Button title={busy ? 'Creating…' : 'Create plan'} small style={{ flex: 1 }} loading={!!busy} disabled={!title.trim() || items.length === 0} onPress={() => start(title, items)} />
          </View>
        </Card>
      ) : (
        <Button title="Start a plan together" variant="secondary" icon={<Ionicons name="map-outline" size={16} color={colors.text} />} onPress={() => setMode('templates')} />
      )}
    </View>
  );
}

function PlanRow({ plan, circleCode }: { plan: StudyPlan; circleCode: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const hasVerse = useStore((s) => s.hasVerse);
  const deleteCirclePlan = useStore((s) => s.deleteCirclePlan);
  const translation = useStore((s) => s.settings.translation);
  const [open, setOpen] = useState(false);

  const doneCount = plan.items.filter((r) => hasVerse(verseId(r, translation))).length;

  const onDelete = () => {
    Alert.alert('Delete this plan?', `"${plan.title}" will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCirclePlan(circleCode, plan.planId).catch(() => {}) },
    ]);
  };

  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="map" size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{plan.title}</Text>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{doneCount} / {plan.items.length} in your library</Text>
        </View>
        <Pressable onPress={onDelete} hitSlop={8} style={{ paddingHorizontal: 4 }}>
          <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
        </Pressable>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textFaint} />
      </Pressable>
      {open ? (
        <View style={{ marginTop: spacing.sm, gap: 6 }}>
          {plan.items.map((r) => {
            const inLib = hasVerse(verseId(r, translation));
            return (
              <Pressable key={r} onPress={() => inLib && router.push(`/verse/${encodeURIComponent(verseId(r, translation))}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name={inLib ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={inLib ? colors.success : colors.textFaint} />
                <Text style={{ color: colors.text, fontSize: font.sizes.sm }}>{r}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

function PrayerCard({ code, myId }: { code: string; myId: string }) {
  const { colors } = useTheme();
  const circle = useCircle(code);
  const addPrayer = useStore((s) => s.addPrayer);
  const prayForRequest = useStore((s) => s.prayForRequest);
  const answerPrayer = useStore((s) => s.answerPrayer);

  const prayers = circle?.prayers ?? [];
  const active = prayers.filter((p) => p.status === 'active');
  const answered = prayers.filter((p) => p.status === 'answered');

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await addPrayer(code, text);
      setText('');
    } catch (e) {
      Alert.alert('Couldn’t add', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <SectionTitle>Praying together</SectionTitle>
      {active.length === 0 ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
          <Ember mood="praying" size={54} />
          <SpeechBubble>{pickEmberLine('prayerReverent', active.length + answered.length)}</SpeechBubble>
        </Card>
      ) : null}
      <Card>
        <TextInput value={text} onChangeText={setText} placeholder="Share a prayer request…" placeholderTextColor={colors.textFaint} multiline style={[fieldStyle(colors), { minHeight: 60 }]} />
        <View style={{ marginTop: spacing.sm }}>
          <Button title={busy ? 'Adding…' : 'Add request'} small loading={busy} disabled={!text.trim()} onPress={add} />
        </View>
      </Card>

      {active.map((p) => (
        <PrayerRow key={p.prayerId} prayer={p} myId={myId} onPray={() => prayForRequest(code, p.prayerId).catch(() => {})} onAnswer={() => answerPrayer(code, p.prayerId).catch(() => {})} />
      ))}

      {answered.length > 0 ? (
        <View style={{ marginTop: spacing.sm }}>
          <SectionTitle>🙌 Answered prayers</SectionTitle>
          {answered.map((p) => (
            <Card key={p.prayerId} style={{ marginBottom: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: font.sizes.md }}>{p.text}</Text>
              <Text style={{ color: colors.success, fontSize: font.sizes.sm, marginTop: 4 }}>✅ Answered{p.answerNote ? ` — ${p.answerNote}` : ''}</Text>
            </Card>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PrayerRow({ prayer, myId, onPray, onAnswer }: { prayer: Prayer; myId: string; onPray: () => void; onAnswer: () => void }) {
  const { colors } = useTheme();
  const didIPray = prayer.prayedByIds?.includes(myId);
  const mine = prayer.by === myId;
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{prayer.byName || 'someone'}</Text>
      <Text style={{ color: colors.text, fontSize: font.sizes.md, marginTop: 2 }}>{prayer.text}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
        <Button
          title={didIPray ? `🙏 Prayed (${prayer.prayedByCount})` : `🙏 I prayed${prayer.prayedByCount ? ` (${prayer.prayedByCount})` : ''}`}
          variant="secondary"
          small
          onPress={onPray}
        />
        {mine ? <Button title="Mark answered" variant="ghost" small onPress={onAnswer} /> : null}
      </View>
    </Card>
  );
}

function NotesCard({ code, myId }: { code: string; myId: string }) {
  const { colors } = useTheme();
  const circle = useCircle(code);
  const shareNote = useStore((s) => s.shareNote);
  const deleteSharedNote = useStore((s) => s.deleteSharedNote);
  const notes = circle?.notes ?? [];

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await shareNote(code, text);
      setText('');
    } catch (e) {
      Alert.alert('Couldn’t share note', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <SectionTitle>Notes to each other</SectionTitle>
      <Card>
        <TextInput value={text} onChangeText={setText} placeholder="Share a note or reflection with your circle…" placeholderTextColor={colors.textFaint} multiline style={[fieldStyle(colors), { minHeight: 60 }]} />
        <View style={{ marginTop: spacing.sm }}>
          <Button title={busy ? 'Sharing…' : 'Share note'} small loading={busy} disabled={!text.trim()} onPress={add} />
        </View>
      </Card>
      {notes.map((n) => (
        <Card key={n.noteId} style={{ marginBottom: spacing.sm }}>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{n.byName || 'someone'}{n.ref ? ` · ${n.ref}` : ''}</Text>
          <Text style={{ color: colors.text, fontSize: font.sizes.md, marginTop: 2 }}>{n.text}</Text>
          {n.by === myId ? (
            <View style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}>
              <Button title="Delete" variant="ghost" small onPress={() => deleteSharedNote(code, n.noteId).catch(() => {})} />
            </View>
          ) : null}
        </Card>
      ))}
    </View>
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
        <SectionTitle style={{ marginBottom: 0 }}>Our goal</SectionTitle>
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
  const removeSharedVerse = useStore((s) => s.removeSharedVerse);
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
      <SectionTitle>Verses we're learning</SectionTitle>
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
              onRemove={() => removeSharedVerse(code, sv.reference).catch(() => {})}
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
  onRemove,
}: {
  sv: SharedVerseRef;
  forLabel: string | null;
  inLibrary: boolean;
  importing: boolean;
  onImport: () => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const confirmRemove = () =>
    Alert.alert('Remove from the list?', `"${sv.reference}" will be removed for everyone in the circle.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onRemove },
    ]);
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
        <Pressable onPress={confirmRemove} hitSlop={8} style={{ paddingHorizontal: 2 }}>
          <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
        </Pressable>
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

const ASSIGN_KINDS: { kind: ChallengeKind; label: string }[] = [
  { kind: 'type', label: 'Recite' },
  { kind: 'reflection', label: 'Reflect' },
  { kind: 'application', label: 'Apply' },
  { kind: 'study', label: 'Study' },
];

function ChallengesCard({ code, members, myId }: { code: string; members: CircleMember[]; myId: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const circle = useCircle(code);
  const assignChallenge = useStore((s) => s.assignChallenge);

  const challenges = circle?.challenges ?? [];
  const others = members.filter((m) => m.id !== myId);

  const toComplete = challenges.filter((c) => c.to === myId && c.status === 'pending');
  const toReview = challenges.filter((c) => c.from === myId && c.status === 'submitted');
  const reviewedForMe = challenges.filter((c) => c.to === myId && c.status === 'reviewed');

  const [assigning, setAssigning] = useState(false);
  const [ref, setRef] = useState('');
  const [toId, setToId] = useState<string | undefined>(others[0]?.id);
  const [kind, setKind] = useState<ChallengeKind>('type');
  const [busy, setBusy] = useState(false);

  const onAssign = async () => {
    const partner = others.find((m) => m.id === toId) ?? others[0];
    if (!partner || !ref.trim()) return;
    setBusy(true);
    try {
      await assignChallenge(code, partner.id, partner.displayName, ref.trim(), kind);
      setRef('');
      setAssigning(false);
    } catch (e) {
      Alert.alert('Couldn’t assign', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <SectionTitle>Spur each other on</SectionTitle>

      {/* Things waiting on me */}
      {toComplete.map((c) => (
        <Card key={c.chalId} style={{ marginBottom: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>
            {c.fromName} challenged you: {c.reference}
          </Text>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginBottom: spacing.sm }}>
            {kindLabel(c.kind)}
          </Text>
          <Button title="Take the challenge" onPress={() => router.push(`/challenge/${code}/${c.chalId}`)} />
        </Card>
      ))}

      {/* Submissions waiting for my review */}
      {toReview.map((c) => (
        <ReviewRow key={c.chalId} code={code} challenge={c} />
      ))}

      {/* Encouragement I received */}
      {reviewedForMe.map((c) => (
        <Card key={c.chalId} style={{ marginBottom: spacing.sm }}>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{c.reference} · reviewed by {c.fromName}</Text>
          {c.review?.note ? <Text style={{ color: colors.text, fontSize: font.sizes.md, marginTop: 2 }}>💛 {c.review.note}</Text> : null}
          {c.review?.meaningPrompt ? <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginTop: 2 }}>💭 {c.review.meaningPrompt}</Text> : null}
        </Card>
      ))}

      {/* Assign */}
      {others.length === 0 ? (
        <Card>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm }}>
            When a partner joins, you can challenge each other with a verse to recite or a passage to reflect on.
          </Text>
        </Card>
      ) : !assigning ? (
        <Button title="Challenge a partner" variant="secondary" icon={<Ionicons name="flash-outline" size={16} color={colors.text} />} onPress={() => setAssigning(true)} />
      ) : (
        <Card>
          <SectionTitle>Challenge a partner</SectionTitle>
          <TextInput value={ref} onChangeText={setRef} placeholder="Reference (e.g. Psalm 23:1)" placeholderTextColor={colors.textFaint} autoCapitalize="words" style={fieldStyle(colors)} />
          {others.length > 1 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
              {others.map((m) => (
                <Chip key={m.id} label={m.displayName || 'partner'} active={toId === m.id} onPress={() => setToId(m.id)} />
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
            {ASSIGN_KINDS.map((k) => (
              <Chip key={k.kind} label={k.label} active={kind === k.kind} onPress={() => setKind(k.kind)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => setAssigning(false)} />
            <Button title={busy ? 'Sending…' : 'Send challenge'} small style={{ flex: 1 }} loading={busy} disabled={!ref.trim()} onPress={onAssign} />
          </View>
        </Card>
      )}
    </View>
  );
}

function ReviewRow({ code, challenge }: { code: string; challenge: Challenge }) {
  const { colors } = useTheme();
  const reviewChallenge = useStore((s) => s.reviewChallenge);
  const [note, setNote] = useState('');
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  const onReview = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await reviewChallenge(code, challenge.chalId, note.trim(), prompt.trim() || undefined);
    } catch (e) {
      Alert.alert('Couldn’t send', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const acc = challenge.submission?.accuracy;

  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>
        {challenge.toName} answered: {challenge.reference}
      </Text>
      {acc != null ? (
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginTop: 2 }}>Word match: {acc}%</Text>
      ) : null}
      {challenge.submission?.text ? (
        <Text style={{ color: colors.text, fontSize: font.sizes.sm, marginTop: spacing.sm, fontStyle: 'italic' }}>
          “{challenge.submission.text}”
        </Text>
      ) : null}
      <TextInput value={note} onChangeText={setNote} placeholder="Encourage them…" placeholderTextColor={colors.textFaint} style={[fieldStyle(colors), { marginTop: spacing.sm }]} />
      <TextInput value={prompt} onChangeText={setPrompt} placeholder="Optional: what does this mean to you?" placeholderTextColor={colors.textFaint} style={[fieldStyle(colors), { marginTop: spacing.sm }]} />
      <View style={{ marginTop: spacing.md }}>
        <Button title={saving ? 'Sending…' : 'Send encouragement'} small loading={saving} disabled={!note.trim()} onPress={onReview} />
      </View>
    </Card>
  );
}

function QuietPartnerNudge({ members, myId }: { members: CircleMember[]; myId: string }) {
  const { colors } = useTheme();
  const today = dayKey();
  const quiet = members.filter(
    (m) => m.id !== myId && m.lastActiveDay && daysBetweenKeys(m.lastActiveDay, today) >= 3,
  );
  if (quiet.length === 0) return null;
  const names = quiet.map((m) => m.displayName || 'your partner').join(' and ');
  return (
    <Card>
      <Text style={{ color: colors.text, fontSize: font.sizes.md }}>
        💛 {names} {quiet.length === 1 ? "hasn't" : "haven't"} practiced in a few days.
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginTop: 4 }}>
        A word of encouragement — or a challenge — might be just what they need today.
      </Text>
    </Card>
  );
}

function kindLabel(kind: ChallengeKind): string {
  switch (kind) {
    case 'recite':
    case 'type':
    case 'fill':
      return 'Recite from memory';
    case 'reflection':
      return 'Reflect on it';
    case 'application':
      return 'Apply it this week';
    case 'study':
      return 'Share a study insight';
    default:
      return 'Challenge';
  }
}
