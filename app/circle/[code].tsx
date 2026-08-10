import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Alert, Share, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, SectionTitle, EmptyState, SpeechBubble } from '@/components/ui';
import { Ember } from '@/components/Ember';
import { pickEmberLine } from '@/data/emberLines';
import { useTheme, spacing, font, radius } from '@/theme';
import { useCircle, useCirclePref, useProfile, useStore } from '@/store/useStore';
import { getVerse, normalizeKey, verseId } from '@/data/bibleApi';
import { dayKey, daysBetweenKeys, relativeTimeAgo } from '@/utils/date';
import { PLAN_TEMPLATES } from '@/data/plans';
import { READING_PLANS, getReadingPlan, planPortionForDate } from '@/data/readingPlans';
import { levelInfo } from '@/gamification';
import { togetherTotals, coverage, mergeActivity, rankMembers, presenceToday, weeklyRecap, circleMilestones, goalProgress } from '@/utils/circleProgress';
import { ProgressRing } from '@/components/ProgressRing';
import { EXPECTED_API_VERSION } from '@/data/circleClient';
import { EmberTip } from '@/components/EmberGuide';
import { usePaged, PageMore } from '@/components/Paginated';
import { ReactionBar } from '@/components/ReactionBar';
import { DailyTogetherCard } from '@/components/DailyTogetherCard';
import { RefText } from '@/components/RefText';
import { PeekableRef } from '@/components/PeekableRef';
import type { Challenge, ChallengeKind, CircleGoal, CircleMember, Note, Prayer, SharedVerseRef, StudyPlan } from '@/types';

const ACCENTS = ['#8AA6FF', '#57D9A3', '#FFC24B', '#FF8A8A', '#C79BFF', '#5AD1E0'];
const EMOJI_CHOICES = ['🔥', '🌱', '🕊️', '📖', '💛', '⭐', '🙏', '🌿', '✝️', '🎵'];

export default function CircleHubScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const code = typeof params.code === 'string' ? params.code.toUpperCase() : '';

  const circle = useCircle(code);
  const profile = useProfile();
  const pref = useCirclePref(code);
  const setCirclePref = useStore((s) => s.setCirclePref);
  const syncCircle = useStore((s) => s.syncCircle);
  const refreshCircle = useStore((s) => s.refreshCircle);
  const leaveCircle = useStore((s) => s.leaveCircle);
  const cheerMember = useStore((s) => s.cheerMember);
  const setCircleName = useStore((s) => s.setCircleName);

  const [syncError, setSyncError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState('');
  // Drill-in: the home shows a compact overview + tiles; a tile opens its section
  // full-screen (in place) so no single page grows unbounded.
  const [view, setView] = useState<Section>('home');

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

  const meta = circle.meta;
  const members = circle.members ?? [];
  const accent = pref.accent ?? colors.primary;
  const hiddenTiles = pref.hiddenTiles ?? [];

  // ---- A drilled-in section fills the screen (with a back-to-home header) ----
  if (view !== 'home') {
    return (
      <Screen>
        <SectionHeader title={SECTION_TITLES[view]} circleName={meta.name} onHome={() => setView('home')} />

        {view === 'people' ? (
          <>
            <LeaderboardCard members={members} />
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
            <WhoKnowsWhatCard members={members} myId={profile.memberId} />
            <TogetherStatsCard members={members} togetherStreak={meta.togetherStreak} />
          </>
        ) : null}

        {view === 'study' ? (
          <>
            <SharedVersesCard code={code} members={members} myId={profile.memberId} />
            <PlansCard code={code} />
            <NotesCard code={code} />
          </>
        ) : null}

        {view === 'prayer' ? <PrayerCard code={code} myId={profile.memberId} /> : null}

        {view === 'challenges' ? <ChallengesCard code={code} members={members} myId={profile.memberId} /> : null}

        {view === 'journal' ? <CircleJournalCard code={code} myId={profile.memberId} accent={accent} /> : null}

        {view === 'settings' ? (
          <>
            <CircleControlsCard code={code} />
            <CircleReadingPlanCard code={code} />
            <CovenantCard code={code} />
            <GoalCard code={code} />
            {renaming ? (
              <Card>
                <SectionTitle>Rename circle</SectionTitle>
                <TextInput value={nameInput} onChangeText={setNameInput} placeholder="Circle name" placeholderTextColor={colors.textFaint} autoFocus style={fieldStyle(colors)} />
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                  <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => setRenaming(false)} />
                  <Button title="Save" small style={{ flex: 1 }} disabled={!nameInput.trim()} onPress={async () => { try { await setCircleName(code, nameInput); } catch {} setRenaming(false); }} />
                </View>
              </Card>
            ) : (
              <Button title="Rename circle" variant="secondary" icon={<Ionicons name="pencil" size={15} color={colors.text} />} onPress={() => { setNameInput(meta.name); setRenaming(true); }} />
            )}
            <View style={{ marginTop: spacing.sm }}>
              <Button title="Leave circle" variant="ghost" onPress={onLeave} />
            </View>
          </>
        ) : null}
      </Screen>
    );
  }

  // ---- Home: a compact overview + the drill-in tile grid ----
  const messagesCount = circle.messages?.length ?? 0;
  const activePrayers = (circle.prayers ?? []).filter((p) => p.status === 'active').length;
  const pendingForMe = (circle.challenges ?? []).filter((c) =>
    (c.kind !== 'duel' && c.to === profile.memberId && c.status === 'pending') ||
    (c.kind !== 'duel' && c.from === profile.memberId && c.status === 'submitted') ||
    (c.kind === 'duel' && (c.from === profile.memberId || c.to === profile.memberId) && !(c.duel ?? []).some((d) => d.by === profile.memberId)),
  ).length;
  const studyCount = (circle.sharedVerses?.length ?? 0) + (circle.plans?.length ?? 0) + (circle.notes?.length ?? 0);

  const tiles: { key: Exclude<Section, 'home'> | 'discussion'; icon: keyof typeof Ionicons.glyphMap; label: string; hint: string; badge: number }[] = [
    { key: 'people', icon: 'people-outline', label: 'People', hint: 'Progress · who knows what', badge: members.length },
    { key: 'study', icon: 'book-outline', label: 'Study together', hint: 'Verses · plans · notes', badge: studyCount },
    { key: 'prayer', icon: 'heart-outline', label: 'Prayer', hint: 'Pray for each other', badge: activePrayers },
    { key: 'challenges', icon: 'flash-outline', label: 'Challenges', hint: 'Spur each other on', badge: pendingForMe },
    { key: 'discussion', icon: 'chatbubbles-outline', label: 'Discussion', hint: 'Talk it through', badge: messagesCount },
    { key: 'journal', icon: 'journal-outline', label: 'Our journal', hint: 'Days we’ve walked together', badge: 0 },
    { key: 'settings', icon: 'settings-outline', label: 'Settings', hint: 'Goal · covenant · more', badge: 0 },
  ];

  const visibleTiles = tiles.filter((t) => !hiddenTiles.includes(t.key));

  return (
    <Screen>
      <Header
        title={pref.emoji ? `${pref.emoji}  ${meta.name}` : meta.name}
        subtitle={`Invite code · ${meta.code}`}
        back
        right={
          <Pressable onPress={() => setView('settings')} hitSlop={8}>
            <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
          </Pressable>
        }
      />

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

      {/* Today, together — the shared daily devotional hero */}
      <DailyTogetherCard code={code} accent={accent} members={members} myId={profile.memberId} />

      {/* Invite — foregrounded only while the circle is still small */}
      {members.length <= 2 ? (
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
      ) : null}

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

      <EmberTip topic="circleHome" />

      {/* Presence — who's had their time today */}
      <PresenceStrip members={members} accent={accent} onOpenMember={(id) => router.push(`/circle/${code}/member/${id}`)} />

      {/* Milestones to celebrate together */}
      <MilestoneCard members={members} goal={meta.goal} togetherStreak={meta.togetherStreak} accent={accent} />

      {/* This week, together */}
      <WeeklyRecapCard members={members} accent={accent} />

      {/* Quiet-partner nudge */}
      <QuietPartnerNudge members={members} myId={profile.memberId} />

      {/* What's happening */}
      <ActivityFeedCard members={members} myId={profile.memberId} />

      {/* Drill-in tiles */}
      <View style={{ gap: spacing.sm }}>
        {visibleTiles.map((t) => (
          <DrillTile
            key={t.key}
            icon={t.icon}
            label={t.label}
            hint={t.hint}
            badge={t.badge}
            accent={accent}
            onPress={() => (t.key === 'discussion' ? router.push(`/circle/${code}/discussion`) : setView(t.key))}
          />
        ))}
      </View>
    </Screen>
  );
}

type Section = 'home' | 'people' | 'study' | 'prayer' | 'challenges' | 'journal' | 'settings';

const SECTION_TITLES: Record<Exclude<Section, 'home'>, string> = {
  people: 'People',
  study: 'Study together',
  prayer: 'Prayer',
  challenges: 'Challenges',
  journal: 'Our journal',
  settings: 'Settings',
};

const CONTROL_TILES: { key: string; label: string }[] = [
  { key: 'people', label: 'People' },
  { key: 'study', label: 'Study together' },
  { key: 'prayer', label: 'Prayer' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'discussion', label: 'Discussion' },
];

/** Per-circle personalization + control: accent, emoji, sharing, hidden tiles. */
function CircleControlsCard({ code }: { code: string }) {
  const { colors } = useTheme();
  const pref = useCirclePref(code);
  const setCirclePref = useStore((s) => s.setCirclePref);
  const globalShare = useStore((s) => s.settings.shareLibrary);
  const sharing = pref.sharing ?? (globalShare ? 'full' : 'counts');
  const hidden = pref.hiddenTiles ?? [];

  const toggleTile = (key: string) =>
    setCirclePref(code, { hiddenTiles: hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key] });

  return (
    <Card style={{ gap: spacing.md }}>
      <SectionTitle style={{ marginBottom: 0 }}>Personalize this circle</SectionTitle>

      {/* Accent */}
      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs, fontWeight: '700' }}>ACCENT</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {ACCENTS.map((c) => (
            <Pressable key={c} onPress={() => setCirclePref(code, { accent: c })} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: (pref.accent ?? '') === c ? 3 : 0, borderColor: colors.text }} />
          ))}
          <Pressable onPress={() => setCirclePref(code, { accent: undefined })} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
            <Ionicons name="refresh" size={14} color={colors.textFaint} />
          </Pressable>
        </View>
      </View>

      {/* Emoji */}
      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs, fontWeight: '700' }}>EMOJI</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {EMOJI_CHOICES.map((e) => (
            <Pressable key={e} onPress={() => setCirclePref(code, { emoji: pref.emoji === e ? undefined : e })} style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: pref.emoji === e ? colors.primarySoft : colors.surfaceAlt }}>
              <Text style={{ fontSize: 18 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Sharing */}
      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs, fontWeight: '700' }}>WHAT I SHARE HERE</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Chip label="Full verse lists" active={sharing === 'full'} onPress={() => setCirclePref(code, { sharing: 'full' })} />
          <Chip label="Counts only" active={sharing === 'counts'} onPress={() => setCirclePref(code, { sharing: 'counts' })} />
        </View>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
          {sharing === 'full' ? 'This circle sees which verses you know and are learning.' : 'This circle sees only your counts, not which verses.'}
        </Text>
      </View>

      {/* Hidden tiles */}
      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs, fontWeight: '700' }}>SHOW ON HOME</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {CONTROL_TILES.map((t) => (
            <Chip key={t.key} label={t.label} active={!hidden.includes(t.key)} onPress={() => toggleTile(t.key)} />
          ))}
        </View>
      </View>

      {/* Mute */}
      <Pressable onPress={() => setCirclePref(code, { muted: !pref.muted })} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name={pref.muted ? 'notifications-off-outline' : 'notifications-outline'} size={18} color={pref.muted ? colors.textFaint : colors.primary} />
        <Text style={{ flex: 1, color: colors.text, fontSize: font.sizes.sm }}>{pref.muted ? 'Notifications muted for this circle' : 'Notifications on'}</Text>
        <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '800' }}>{pref.muted ? 'Unmute' : 'Mute'}</Text>
      </Pressable>
    </Card>
  );
}

/** Header for a drilled-in section: a back chip returns to the circle home. */
function SectionHeader({ title, circleName, onHome }: { title: string; circleName: string; onHome: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Pressable onPress={onHome} hitSlop={12} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.xl }}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }} numberOfLines={1}>{circleName}</Text>
      </View>
    </View>
  );
}

/** The circle's shared journal — a dated timeline of the days walked together
 *  (each day's devotional + everyone's shared reflections). The collaborative
 *  record of "what the Lord taught us." */
function CircleJournalCard({ code, myId, accent }: { code: string; myId: string; accent: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const circle = useCircle(code);
  const days = useMemo(() => {
    const map = circle?.daily ?? {};
    return Object.values(map)
      .filter((d) => (d.reflections?.length ?? 0) > 0 || d.reading || d.verse || d.song || d.prayer)
      .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  }, [circle?.daily]);
  const page = usePaged(days, 10, days.length);

  if (days.length === 0) {
    return (
      <EmptyState
        emoji="📔"
        title="Your circle’s journal"
        subtitle="Each day you walk together — the song, the reading, and what the Lord showed each of you — is recorded here. Set today’s devotional on the home screen to begin."
      />
    );
  }

  const label = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
        A dated record of the days you’ve walked together — the readings, the songs, and what He showed each of you.
      </Text>
      {page.shown.map((d) => (
        <Card key={d.day} style={{ gap: 6, borderLeftWidth: 3, borderLeftColor: accent }}>
          <Text style={{ color: accent, fontWeight: '800', fontSize: font.sizes.sm }}>{label(d.day)}</Text>
          {d.song ? <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs }}>🎵 {d.song}</Text> : null}
          {d.reading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="book-outline" size={12} color={colors.textFaint} />
              <PeekableRef reference={d.reading} tone="plain" />
            </View>
          ) : null}
          {d.verse ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="bookmark-outline" size={12} color={colors.textFaint} />
              <PeekableRef reference={d.verse} tone="plain" />
            </View>
          ) : null}
          {(d.reflections ?? []).map((r) => (
            <View key={r.by} style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, gap: 2 }}>
              <Text style={{ color: colors.textFaint, fontSize: 10, fontWeight: '800' }}>{r.by === myId ? 'YOU' : (r.byName || 'A partner').toUpperCase()}</Text>
              <RefText text={r.text} style={{ color: colors.text, fontSize: font.sizes.sm, lineHeight: 21, fontFamily: font.serif }} />
            </View>
          ))}
        </Card>
      ))}
      <PageMore remaining={page.remaining} step={10} onPress={page.showMore} noun="earlier days" />
    </View>
  );
}

/** A home tile that drills into a section, with a live count badge. */
function DrillTile({ icon, label, hint, badge, accent, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; hint: string; badge: number; accent: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{label}</Text>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{hint}</Text>
      </View>
      {badge > 0 ? (
        <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.onPrimary, fontSize: font.sizes.xs, fontWeight: '800' }}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Card>
  );
}

/** "Who's had their time today" — presence avatars from lastActiveDay. */
function PresenceStrip({ members, accent, onOpenMember }: { members: CircleMember[]; accent: string; onOpenMember: (id: string) => void }) {
  const { colors } = useTheme();
  const today = dayKey();
  const p = presenceToday(members, today);
  const activeSet = new Set(p.activeIds);
  if (members.length < 2) return null;
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionTitle style={{ marginBottom: 0 }}>Today</SectionTitle>
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs }}>
          {p.activeIds.length} of {p.total} had their time
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {members.map((m) => {
          const active = activeSet.has(m.id);
          return (
            <Pressable key={m.id} onPress={() => onOpenMember(m.id)} style={{ alignItems: 'center', width: 52 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? accent : colors.surfaceAlt, borderWidth: active ? 0 : 1, borderColor: colors.border, opacity: active ? 1 : 0.7 }}>
                <Text style={{ color: active ? colors.onPrimary : colors.textFaint, fontWeight: '800' }}>{(m.displayName || '?').trim().charAt(0).toUpperCase()}</Text>
              </View>
              <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 10, marginTop: 2, maxWidth: 52 }}>{m.displayName || '—'}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

/** A warm "this week, together" summary from recent activity. */
function WeeklyRecapCard({ members, accent }: { members: CircleMember[]; accent: string }) {
  const { colors } = useTheme();
  const recap = useMemo(() => weeklyRecap(members, Date.now()), [members]);
  if (recap.empty || members.length < 2) return null;
  const bits: string[] = [];
  if (recap.memorized) bits.push(`${recap.memorized} verse${recap.memorized === 1 ? '' : 's'} hidden away`);
  if (recap.reviewed) bits.push(`${recap.reviewed} review${recap.reviewed === 1 ? '' : 's'}`);
  if (recap.studied) bits.push(`${recap.studied} passage${recap.studied === 1 ? '' : 's'} studied`);
  return (
    <Card style={{ gap: 4, borderLeftWidth: 3, borderLeftColor: accent }}>
      <SectionTitle style={{ marginBottom: 0 }}>This week, together</SectionTitle>
      <Text style={{ color: colors.text, fontSize: font.sizes.md }}>{bits.join('  ·  ')}</Text>
      {recap.topMemberName ? (
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>💛 {recap.topMemberName} led the way in memorizing.</Text>
      ) : null}
      <Text style={{ color: colors.textFaint, fontSize: 10 }}>Recent highlights across your circle.</Text>
    </Card>
  );
}

/** Celebrate shared achievements: "we all know this now", goal reached, streak. */
function MilestoneCard({ members, goal, togetherStreak, accent }: { members: CircleMember[]; goal: CircleGoal | null; togetherStreak: number; accent: string }) {
  const { colors } = useTheme();
  const ms = useMemo(() => circleMilestones(members, goal, togetherStreak), [members, goal, togetherStreak]);
  if (!ms.any) return null;
  return (
    <Card style={{ gap: spacing.sm, borderWidth: 1, borderColor: accent }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={{ fontSize: 20 }}>🎉</Text>
        <SectionTitle style={{ marginBottom: 0 }}>Together, you did it</SectionTitle>
      </View>
      {ms.streakMilestone ? (
        <Text style={{ color: colors.text, fontSize: font.sizes.md, fontWeight: '700' }}>🔥 {ms.streakMilestone}-day together streak — faithful, all of you.</Text>
      ) : null}
      {ms.goalReached ? (
        <Text style={{ color: colors.text, fontSize: font.sizes.md, fontWeight: '700' }}>🎯 You reached your shared goal!</Text>
      ) : null}
      {ms.allKnow.length > 0 ? (
        <Text style={{ color: colors.text, fontSize: font.sizes.md }}>
          🌟 You <Text style={{ fontWeight: '800' }}>all</Text> know {ms.allKnow.length === 1 ? ms.allKnow[0].display : `${ms.allKnow.length} verses`} now.
        </Text>
      ) : null}
    </Card>
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
    line = `🤝 ${(member.versesDone ?? []).length} / ${goal.target} shared   ·   🔥 ${member.streak}`;
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
  read: { emoji: '📖', verb: 'read' },
  noted: { emoji: '📝', verb: 'shared a note on' },
};

const MEDALS = ['🥇', '🥈', '🥉'];

function LeaderboardCard({ members }: { members: CircleMember[] }) {
  const { colors } = useTheme();
  const ranked = useMemo(() => rankMembers(members), [members]);
  if (ranked.length < 2) return null;
  return (
    <View>
      <SectionTitle>Leaderboard</SectionTitle>
      <Card style={{ gap: spacing.sm }}>
        {ranked.map((m, i) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text style={{ width: 26, textAlign: 'center', fontSize: font.sizes.md }}>{MEDALS[i] ?? `${i + 1}`}</Text>
            <Text style={{ flex: 1, color: colors.text, fontWeight: '700', fontSize: font.sizes.md }} numberOfLines={1}>{m.displayName}</Text>
            <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>📖 {m.memorizedCount}</Text>
            <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>🔥 {m.streak}</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

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
  const updateCirclePlan = useStore((s) => s.updateCirclePlan);
  const translation = useStore((s) => s.settings.translation);
  const [open, setOpen] = useState(false);

  // Edit state (reuses the custom-plan builder pattern).
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [items, setItems] = useState<string[]>(plan.items);
  const [refInput, setRefInput] = useState('');
  const [saving, setSaving] = useState(false);

  const doneCount = plan.items.filter((r) => hasVerse(verseId(r, translation))).length;

  const onDelete = () => {
    Alert.alert('Delete this plan?', `"${plan.title}" will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCirclePlan(circleCode, plan.planId).catch(() => {}) },
    ]);
  };

  const startEdit = () => {
    setTitle(plan.title);
    setItems(plan.items);
    setRefInput('');
    setOpen(false);
    setEditing(true);
  };

  const addRef = () => {
    const r = refInput.trim();
    if (!r) return;
    setItems((prev) => (prev.includes(r) ? prev : [...prev, r]));
    setRefInput('');
  };

  const saveEdit = async () => {
    if (!title.trim() || items.length === 0) return;
    setSaving(true);
    try {
      await updateCirclePlan(circleCode, plan.planId, title.trim(), items);
      setEditing(false);
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Card style={{ marginBottom: spacing.sm }}>
        <SectionTitle>Edit plan</SectionTitle>
        <TextInput value={title} onChangeText={setTitle} placeholder="Plan name" placeholderTextColor={colors.textFaint} style={fieldStyle(colors)} />
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
          <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => setEditing(false)} />
          <Button title={saving ? 'Saving…' : 'Save plan'} small style={{ flex: 1 }} loading={saving} disabled={!title.trim() || items.length === 0} onPress={saveEdit} />
        </View>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="map" size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{plan.title}</Text>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{doneCount} / {plan.items.length} in your library</Text>
        </View>
        <Pressable onPress={startEdit} hitSlop={8} style={{ paddingHorizontal: 4 }}>
          <Ionicons name="pencil" size={15} color={colors.textFaint} />
        </Pressable>
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
  const reopenPrayer = useStore((s) => s.reopenPrayer);
  const deletePrayer = useStore((s) => s.deletePrayer);

  const prayers = circle?.prayers ?? [];
  const active = prayers.filter((p) => p.status === 'active');
  const answered = prayers.filter((p) => p.status === 'answered');
  const activePage = usePaged(active, 15, active.length);

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

  const confirmDelete = (prayerId: string) =>
    Alert.alert('Delete this prayer?', 'It will be removed for everyone in the circle.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePrayer(code, prayerId).catch(() => {}) },
    ]);

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

      {activePage.shown.map((p) => (
        <PrayerRow key={p.prayerId} code={code} prayer={p} myId={myId} onDelete={() => confirmDelete(p.prayerId)} />
      ))}
      <PageMore remaining={activePage.remaining} step={15} onPress={activePage.showMore} noun="more requests" />

      {answered.length > 0 ? (
        <View style={{ marginTop: spacing.sm }}>
          <SectionTitle>🙌 Answered prayers</SectionTitle>
          {answered.map((p) => (
            <Card key={p.prayerId} style={{ marginBottom: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: font.sizes.md }}>{p.text}</Text>
              <Text style={{ color: colors.success, fontSize: font.sizes.sm, marginTop: 4 }}>✅ Answered{p.answerNote ? ` — ${p.answerNote}` : ''}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignSelf: 'flex-start' }}>
                <Button title="Reopen" variant="ghost" small onPress={() => reopenPrayer(code, p.prayerId).catch(() => {})} />
                <Button title="Delete" variant="ghost" small onPress={() => confirmDelete(p.prayerId)} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PrayerRow({ code, prayer, myId, onDelete }: { code: string; prayer: Prayer; myId: string; onDelete: () => void }) {
  const { colors } = useTheme();
  const togglePrayed = useStore((s) => s.togglePrayed);
  const answerPrayer = useStore((s) => s.answerPrayer);
  const editPrayer = useStore((s) => s.editPrayer);
  const didIPray = prayer.prayedByIds?.includes(myId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(prayer.text);
  const [answering, setAnswering] = useState(false);
  const [answerNote, setAnswerNote] = useState('');
  const [busy, setBusy] = useState(false);

  const saveEdit = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await editPrayer(code, prayer.prayerId, draft);
      setEditing(false);
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async () => {
    setBusy(true);
    try {
      await answerPrayer(code, prayer.prayerId, answerNote.trim() || undefined);
      setAnswering(false);
      setAnswerNote('');
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, flex: 1 }}>{prayer.byName || 'someone'}</Text>
        <Pressable onPress={() => { setDraft(prayer.text); setEditing((v) => !v); }} hitSlop={8} style={{ paddingHorizontal: 4 }}>
          <Ionicons name="pencil" size={15} color={colors.textFaint} />
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8} style={{ paddingHorizontal: 4 }}>
          <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
        </Pressable>
      </View>

      {editing ? (
        <View style={{ marginTop: spacing.sm }}>
          <TextInput value={draft} onChangeText={setDraft} multiline autoFocus placeholderTextColor={colors.textFaint} style={[fieldStyle(colors), { minHeight: 54 }]} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => setEditing(false)} />
            <Button title={busy ? 'Saving…' : 'Save'} small style={{ flex: 1 }} loading={busy} disabled={!draft.trim()} onPress={saveEdit} />
          </View>
        </View>
      ) : (
        <Text style={{ color: colors.text, fontSize: font.sizes.md, marginTop: 2 }}>{prayer.text}</Text>
      )}

      {!editing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
          <Button
            title={didIPray ? `🙏 Prayed (${prayer.prayedByCount})` : `🙏 I prayed${prayer.prayedByCount ? ` (${prayer.prayedByCount})` : ''}`}
            variant={didIPray ? 'primary' : 'secondary'}
            small
            onPress={() => togglePrayed(code, prayer).catch(() => {})}
          />
          <Button title="Mark answered" variant="ghost" small onPress={() => setAnswering((v) => !v)} />
        </View>
      ) : null}

      {answering ? (
        <View style={{ marginTop: spacing.sm }}>
          <TextInput value={answerNote} onChangeText={setAnswerNote} placeholder="How was it answered? (optional)" placeholderTextColor={colors.textFaint} multiline style={[fieldStyle(colors), { minHeight: 48 }]} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => setAnswering(false)} />
            <Button title={busy ? 'Saving…' : 'Answered 🙌'} small style={{ flex: 1 }} loading={busy} onPress={submitAnswer} />
          </View>
        </View>
      ) : null}

      {!editing ? <ReactionBar code={code} targetType="prayer" targetId={prayer.prayerId} /> : null}
    </Card>
  );
}

function NotesCard({ code }: { code: string }) {
  const { colors } = useTheme();
  const circle = useCircle(code);
  const shareNote = useStore((s) => s.shareNote);
  const notes = circle?.notes ?? [];
  const notesPage = usePaged(notes, 15, notes.length);

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
      {notesPage.shown.map((n) => (
        <NoteRow key={n.noteId} code={code} note={n} />
      ))}
      <PageMore remaining={notesPage.remaining} step={15} onPress={notesPage.showMore} noun="more notes" />
    </View>
  );
}

function NoteRow({ code, note }: { code: string; note: Note }) {
  const { colors } = useTheme();
  const editSharedNote = useStore((s) => s.editSharedNote);
  const deleteSharedNote = useStore((s) => s.deleteSharedNote);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await editSharedNote(code, note.noteId, draft, note.scope, note.ref);
      setEditing(false);
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete this note?', 'It will be removed for everyone in the circle.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSharedNote(code, note.noteId).catch(() => {}) },
    ]);

  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, flex: 1 }}>{note.byName || 'someone'}{note.ref ? ` · ${note.ref}` : ''}</Text>
        <Pressable onPress={() => { setDraft(note.text); setEditing((v) => !v); }} hitSlop={8} style={{ paddingHorizontal: 4 }}>
          <Ionicons name="pencil" size={15} color={colors.textFaint} />
        </Pressable>
        <Pressable onPress={confirmDelete} hitSlop={8} style={{ paddingHorizontal: 4 }}>
          <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
        </Pressable>
      </View>
      {editing ? (
        <View style={{ marginTop: spacing.sm }}>
          <TextInput value={draft} onChangeText={setDraft} multiline autoFocus placeholderTextColor={colors.textFaint} style={[fieldStyle(colors), { minHeight: 54 }]} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => setEditing(false)} />
            <Button title={busy ? 'Saving…' : 'Save'} small style={{ flex: 1 }} loading={busy} disabled={!draft.trim()} onPress={save} />
          </View>
        </View>
      ) : (
        <Text style={{ color: colors.text, fontSize: font.sizes.md, marginTop: 2 }}>{note.text}</Text>
      )}
      {!editing ? <ReactionBar code={code} targetType="note" targetId={note.noteId} /> : null}
    </Card>
  );
}

const GOAL_KINDS: { kind: CircleGoal['kind']; label: string; hasTarget: boolean }[] = [
  { kind: 'memorizeCount', label: 'Each memorize N', hasTarget: true },
  { kind: 'sharedVerses', label: 'All shared verses', hasTarget: false },
  { kind: 'streak', label: 'N-day streak', hasTarget: true },
];

/** Choose the circle's shared reading plan — it auto-advances by date, and today's
 *  portion appears in the "Today, together" hero (unless a member overrides it). */
function CircleReadingPlanCard({ code }: { code: string }) {
  const { colors } = useTheme();
  const circle = useCircle(code);
  const setCircleReadingPlan = useStore((s) => s.setCircleReadingPlan);
  const planId = circle?.meta?.readingPlanId ?? null;
  const startedAt = circle?.meta?.readingPlanStartedAt ?? null;
  const portion = useMemo(() => planPortionForDate(planId, startedAt, dayKey()), [planId, startedAt]);

  return (
    <Card style={{ gap: spacing.sm }}>
      <SectionTitle style={{ marginBottom: 0 }}>Shared reading plan</SectionTitle>
      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
        Walk the Word together — the plan advances a day at a time and shows up in “Today, together”.
      </Text>
      <View style={{ gap: spacing.sm }}>
        {READING_PLANS.map((p) => {
          const active = planId === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setCircleReadingPlan(code, active ? null : p.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : 'transparent' }}
            >
              <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={active ? colors.primary : colors.textFaint} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.sm }}>{p.title}</Text>
                <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{p.description}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {portion ? (
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs }}>
          Today is day {portion.dayNumber} of {portion.total}: {portion.refs.join(' · ')}
        </Text>
      ) : null}
    </Card>
  );
}

function GoalCard({ code }: { code: string }) {
  const { colors } = useTheme();
  const circle = useCircle(code);
  const setCircleGoal = useStore((s) => s.setCircleGoal);
  const goal = circle?.meta?.goal ?? null;
  const members = circle?.members ?? [];
  const togetherStreak = circle?.meta?.togetherStreak ?? 0;
  const sharedCount = (circle?.sharedVerses ?? []).length;
  const progress = goal ? goalProgress(members, goal, togetherStreak) : null;

  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<CircleGoal['kind']>(goal?.kind ?? 'memorizeCount');
  const [target, setTarget] = useState(goal?.target ?? 5);
  const [customLabel, setCustomLabel] = useState('');
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
      customLabel.trim() ? customLabel.trim()
      : kind === 'memorizeCount' ? `Each memorize ${t} verses`
      : kind === 'sharedVerses' ? 'Memorize all shared verses'
      : `Reach a ${t}-day streak`;
    save({ kind, target: t, label });
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionTitle style={{ marginBottom: 0 }}>Our goal</SectionTitle>
        {!editing ? (
          <Button title={goal ? 'Edit' : 'Set'} variant="secondary" small onPress={() => { setKind(goal?.kind ?? 'memorizeCount'); setTarget(goal?.target ?? 5); setCustomLabel(goal?.label ?? ''); setEditing(true); }} />
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
          <TextInput
            value={customLabel}
            onChangeText={setCustomLabel}
            placeholder="Custom name (optional, e.g. Our Lent challenge)"
            placeholderTextColor={colors.textFaint}
            style={fieldStyle(colors)}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {goal ? <Button title="Clear" variant="ghost" small style={{ flex: 1 }} onPress={() => save(null)} /> : null}
            <Button title={saving ? 'Saving…' : 'Save goal'} small style={{ flex: 1 }} loading={saving} onPress={onSave} />
          </View>
        </View>
      ) : goal ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
          {progress ? <ProgressRing progress={Math.round(progress.fraction * 100)} size={54} stroke={6} label={`${Math.round(progress.fraction * 100)}%`} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: font.sizes.md, fontWeight: '700' }}>🎯 {goal.label ?? `${goal.kind} · ${goal.target}`}</Text>
            {progress ? <Text style={{ color: progress.reached ? colors.success : colors.textMuted, fontSize: font.sizes.sm, marginTop: 2 }}>{progress.reached ? '🎉 Reached together!' : progress.label}</Text> : null}
          </View>
        </View>
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
  const sharedPage = usePaged(shared, 15, shared.length);
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
          {sharedPage.shown.map((sv) => (
            <SharedVerseRow
              key={normalizeKey(sv.reference)}
              sv={sv}
              forLabel={sv.forMemberId ? (sv.forMemberId === myId ? 'for you' : `for ${nameOf(sv.forMemberId)}`) : null}
              inLibrary={hasVerse(verseId(sv.reference, translation))}
              importing={importing === sv.reference}
              onImport={() => onImport(sv.reference)}
              onOpen={() => router.push(`/verse/${encodeURIComponent(verseId(sv.reference, translation))}`)}
              onRemove={() => removeSharedVerse(code, sv.reference).catch(() => {})}
              onDiscuss={() => router.push(`/circle/${code}/discussion?context=${encodeURIComponent(sv.reference)}`)}
            />
          ))}
          <PageMore remaining={sharedPage.remaining} step={15} onPress={sharedPage.showMore} noun="more verses" />
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
  onDiscuss,
}: {
  sv: SharedVerseRef;
  forLabel: string | null;
  inLibrary: boolean;
  importing: boolean;
  onImport: () => void;
  onOpen: () => void;
  onRemove: () => void;
  onDiscuss: () => void;
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
        <Pressable onPress={onDiscuss} hitSlop={8} style={{ paddingHorizontal: 2 }}>
          <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.textFaint} />
        </Pressable>
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
  { kind: 'duel', label: 'Duel ⚔️' },
  { kind: 'reflection', label: 'Reflect' },
  { kind: 'application', label: 'Apply' },
  { kind: 'study', label: 'Study' },
];

function ChallengesCard({ code, members, myId }: { code: string; members: CircleMember[]; myId: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const circle = useCircle(code);
  const assignChallenge = useStore((s) => s.assignChallenge);
  const deleteChallenge = useStore((s) => s.deleteChallenge);

  const challenges = circle?.challenges ?? [];
  const others = members.filter((m) => m.id !== myId);

  const duels = challenges.filter((c) => c.kind === 'duel' && (c.from === myId || c.to === myId));
  const toComplete = challenges.filter((c) => c.kind !== 'duel' && c.to === myId && c.status === 'pending');
  const toReview = challenges.filter((c) => c.kind !== 'duel' && c.from === myId && c.status === 'submitted');
  const reviewedForMe = challenges.filter((c) => c.kind !== 'duel' && c.to === myId && c.status === 'reviewed');

  const confirmCancel = (chalId: string) =>
    Alert.alert('Remove this challenge?', 'It will be removed for both of you.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteChallenge(code, chalId).catch(() => {}) },
    ]);

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

      {/* Duels */}
      {duels.map((c) => {
        const scores = c.duel ?? [];
        const iPlayed = scores.some((d) => d.by === myId);
        return (
          <Card key={c.chalId} style={{ marginBottom: spacing.sm, gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md, flex: 1 }}>⚔️ Duel · {c.reference}</Text>
              <Pressable onPress={() => confirmCancel(c.chalId)} hitSlop={8} style={{ paddingHorizontal: 4 }}>
                <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
              </Pressable>
            </View>
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{c.fromName} vs {c.toName}</Text>
            {scores.map((d, i) => (
              <View key={d.by} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ width: 20, textAlign: 'center' }}>{i === 0 && scores.length > 1 ? '🏆' : '·'}</Text>
                <Text style={{ flex: 1, color: colors.text }}>{d.by === myId ? 'You' : d.byName}</Text>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>{d.accuracy}%</Text>
              </View>
            ))}
            <Button title={iPlayed ? 'Play again' : 'Play the duel'} small variant={iPlayed ? 'secondary' : 'primary'} onPress={() => router.push(`/challenge/${code}/${c.chalId}`)} />
          </Card>
        );
      })}

      {/* Things waiting on me */}
      {toComplete.map((c) => (
        <Card key={c.chalId} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md, flex: 1 }}>
              {c.fromName} challenged you: {c.reference}
            </Text>
            <Pressable onPress={() => confirmCancel(c.chalId)} hitSlop={8} style={{ paddingHorizontal: 4 }}>
              <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
            </Pressable>
          </View>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginBottom: spacing.sm }}>
            {kindLabel(c.kind)}
          </Text>
          <Button title="Take the challenge" onPress={() => router.push(`/challenge/${code}/${c.chalId}`)} />
        </Card>
      ))}

      {/* Submissions waiting for my review */}
      {toReview.map((c) => (
        <ReviewRow key={c.chalId} code={code} challenge={c} onCancel={() => confirmCancel(c.chalId)} />
      ))}

      {/* Encouragement I received */}
      {reviewedForMe.map((c) => (
        <Card key={c.chalId} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, flex: 1 }}>{c.reference} · reviewed by {c.fromName}</Text>
            <Pressable onPress={() => confirmCancel(c.chalId)} hitSlop={8} style={{ paddingHorizontal: 4 }}>
              <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
            </Pressable>
          </View>
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

function ReviewRow({ code, challenge, onCancel }: { code: string; challenge: Challenge; onCancel: () => void }) {
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
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md, flex: 1 }}>
          {challenge.toName} answered: {challenge.reference}
        </Text>
        <Pressable onPress={onCancel} hitSlop={8} style={{ paddingHorizontal: 4 }}>
          <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
        </Pressable>
      </View>
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
