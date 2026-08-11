import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card, Button, SectionTitle } from '@/components/ui';
import { RefText } from '@/components/RefText';
import { PeekableRef } from '@/components/PeekableRef';
import { useTheme, spacing, font, radius } from '@/theme';
import { useCircle, useProfile, useStore, useSongbook } from '@/store/useStore';
import { dayKey } from '@/utils/date';
import { parsePassage } from '@/data/books';
import { planPortionForDate } from '@/data/readingPlans';
import { matchSongByTitle } from '@/data/songbook';
import type { CircleMember, CircleDaily } from '@/types';

/**
 * "Today, together" — the shared daily devotional hero. Any member can set the
 * day's song / reading / prayer / verse; everyone reads the same portion, marks
 * the day done (lighting up the presence row), and shares a reflection into the
 * circle's journal. The reading auto-advances from the circle's shared plan when
 * no explicit reading is set.
 */
export function DailyTogetherCard({ code, accent, members, myId }: { code: string; accent: string; members: CircleMember[]; myId: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const songbook = useSongbook();
  const circle = useCircle(code);
  const profile = useProfile();
  const completeCircleDaily = useStore((s) => s.completeCircleDaily);
  const adoptReflection = useStore((s) => s.adoptReflection);
  const adoptVerse = useStore((s) => s.adoptVerse);

  const today = dayKey();
  const day = circle?.daily?.[today];
  const discuss = (anchor: string) => router.push(`/circle/${code}/discussion?context=${encodeURIComponent(anchor)}`);
  const onAdoptReflection = (text: string, byName: string) => {
    adoptReflection(text, byName);
    Alert.alert('Saved to your notes 💛', `${byName || 'Your partner'}’s reflection is now a note in your workspace.`);
  };
  const onAdoptVerse = (ref: string) => {
    adoptVerse(ref).then(() => Alert.alert('Added to your library', `${ref} is now in your verses to memorize.`)).catch(() => {});
  };
  const [editing, setEditing] = useState(false);
  const [reflecting, setReflecting] = useState(false);

  // Reading: explicit override, else the shared plan's portion for today.
  const planPortion = useMemo(
    () => planPortionForDate(circle?.meta?.readingPlanId, circle?.meta?.readingPlanStartedAt, today),
    [circle?.meta?.readingPlanId, circle?.meta?.readingPlanStartedAt, today],
  );
  const readingRefs: string[] = day?.reading ? [day.reading] : planPortion?.refs ?? [];

  const doneIds = day?.doneByIds ?? [];
  const iAmDone = doneIds.includes(myId);
  const reflections = day?.reflections ?? [];
  const isEmpty = !day?.song && !day?.reading && !day?.prayer && !day?.verse && !day?.note && readingRefs.length === 0;

  const openReading = (ref: string) => {
    const p = parsePassage(ref);
    if (p) router.push(`/read/${p.bookNumber}/${p.chapter}`);
  };
  const openSong = (title: string) => {
    const hymn = matchSongByTitle(title, songbook);
    if (hymn) router.push(`/songbook/${hymn.id}`);
    else router.push(`/songbook?q=${encodeURIComponent(title)}`);
  };

  return (
    <Card style={{ borderColor: accent, borderWidth: 1.5, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="sunny" size={20} color={accent} />
        <Text style={{ flex: 1, color: colors.text, fontWeight: '800', fontSize: font.sizes.lg }}>Today, together</Text>
        <Pressable onPress={() => setEditing((v) => !v)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name={editing ? 'close' : 'create-outline'} size={16} color={accent} />
          <Text style={{ color: accent, fontWeight: '800', fontSize: font.sizes.xs }}>{editing ? 'Close' : isEmpty ? 'Set today' : 'Edit'}</Text>
        </Pressable>
      </View>

      {isEmpty && !editing ? (
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm, lineHeight: 20 }}>
          No devotional set yet. Anyone can choose today’s song, reading, and prayer — tap “Set today”.
        </Text>
      ) : null}

      {editing ? <DailyEditor code={code} day={today} initial={day} onDone={() => setEditing(false)} /> : null}

      {!editing ? (
        <View style={{ gap: spacing.sm }}>
          {day?.song ? (
            <DailyRow icon="musical-notes" tint={colors.accent} label="Sing">
              <Pressable onPress={() => openSong(day.song!)}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.sizes.md, textDecorationLine: 'underline' }}>{day.song}</Text>
              </Pressable>
            </DailyRow>
          ) : null}

          {readingRefs.length > 0 ? (
            <DailyRow icon="book" tint={colors.primary} label={planPortion && !day?.reading ? `Read · day ${planPortion.dayNumber}` : 'Read'}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {readingRefs.map((r) => (
                  <Pressable key={r} onPress={() => openReading(r)} style={{ paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.sizes.xs }}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            </DailyRow>
          ) : null}

          {day?.verse ? (
            <DailyRow icon="bookmark" tint={colors.warning} label="Carry">
              <PeekableRef reference={day.verse} tone="plain" />
            </DailyRow>
          ) : null}

          {day?.prayer ? (
            <DailyRow icon="heart" tint={colors.danger} label="Pray">
              <RefText text={day.prayer} style={{ color: colors.text, fontSize: font.sizes.sm, lineHeight: 21 }} />
            </DailyRow>
          ) : null}

          {day?.note ? (
            <RefText text={day.note} style={{ color: colors.textMuted, fontSize: font.sizes.sm, fontStyle: 'italic', lineHeight: 20 }} />
          ) : null}

          {day?.setByName ? (
            <Text style={{ color: colors.textFaint, fontSize: 10 }}>Set by {day.setByName}</Text>
          ) : null}

          {/* Presence — who's completed today */}
          {!isEmpty ? (
            <View style={{ gap: 6, marginTop: 2 }}>
              <PresenceRow members={members} doneIds={doneIds} accent={accent} />
              <Button
                title={iAmDone ? 'Done today ✓' : 'I met with Him today'}
                small
                variant={iAmDone ? 'secondary' : 'primary'}
                onPress={() => completeCircleDaily(code, today)}
                icon={<Ionicons name={iAmDone ? 'checkmark-circle' : 'checkmark-circle-outline'} size={16} color={iAmDone ? colors.text : colors.onPrimary} />}
              />
            </View>
          ) : null}

          {/* Reflections — the circle journal for today */}
          {!isEmpty ? (
            <View style={{ gap: spacing.sm, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>
                  REFLECTIONS {reflections.length ? `· ${reflections.length}` : ''}
                </Text>
                <Pressable onPress={() => setReflecting((v) => !v)} hitSlop={8}>
                  <Text style={{ color: accent, fontWeight: '800', fontSize: font.sizes.xs }}>{reflecting ? 'Close' : 'Share yours'}</Text>
                </Pressable>
              </View>
              {reflecting ? (
                <ReflectionComposer code={code} day={today} mine={reflections.find((r) => r.by === myId)?.text ?? ''} onDone={() => setReflecting(false)} />
              ) : null}
              {reflections.map((r) => {
                const mine = r.by === myId;
                return (
                  <View key={r.by} style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, gap: 4 }}>
                    <Text style={{ color: accent, fontWeight: '800', fontSize: font.sizes.xs }}>{mine ? 'You' : r.byName || 'A partner'}</Text>
                    <RefText text={r.text} style={{ color: colors.text, fontSize: font.sizes.sm, lineHeight: 21, fontFamily: font.serif }} />
                    <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: 2 }}>
                      {!mine ? (
                        <Pressable onPress={() => onAdoptReflection(r.text, r.byName)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="add-circle-outline" size={14} color={colors.success} />
                          <Text style={{ color: colors.success, fontSize: font.sizes.xs, fontWeight: '700' }}>Add to my notes</Text>
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => discuss(`${(mine ? profile.displayName : r.byName) || 'partner'}'s reflection · ${today}`)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>Discuss</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {reflections.length === 0 && !reflecting ? (
                <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>Be the first to share what He showed you today.</Text>
              ) : null}
            </View>
          ) : null}

          {/* Our devotions — what each of you brought today (verses & songs) */}
          <SharesWindow
            code={code}
            day={today}
            shares={day?.shares ?? []}
            myId={myId}
            accent={accent}
            onAdoptVerse={onAdoptVerse}
            onDiscuss={discuss}
            onOpenSong={openSong}
          />
        </View>
      ) : null}
    </Card>
  );
}

/**
 * The "two walks, one window" strip: each member's broadcast verses/songs for
 * the day, attributed, with Adopt (→ my library) + Discuss on a partner's, and
 * one-tap "bring a verse/song" for me.
 */
function SharesWindow({
  code,
  day,
  shares,
  myId,
  accent,
  onAdoptVerse,
  onDiscuss,
  onOpenSong,
}: {
  code: string;
  day: string;
  shares: { by: string; byName: string; verses: string[]; songs: string[] }[];
  myId: string;
  accent: string;
  onAdoptVerse: (ref: string) => void;
  onDiscuss: (anchor: string) => void;
  onOpenSong: (title: string) => void;
}) {
  const { colors } = useTheme();
  const shareDailyItem = useStore((s) => s.shareDailyItem);
  const [adding, setAdding] = useState<null | 'verse' | 'song'>(null);
  const [draft, setDraft] = useState('');

  const submit = () => {
    const v = draft.trim();
    if (!v || !adding) return;
    shareDailyItem(code, day, adding, v).catch(() => {});
    setDraft('');
    setAdding(null);
  };

  const others = shares.filter((s) => s.by !== myId);
  const mine = shares.find((s) => s.by === myId);

  return (
    <View style={{ gap: spacing.sm, marginTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>FROM EACH OTHER’S WALK</Text>
        <Pressable onPress={() => setAdding(adding === 'verse' ? null : 'verse')} hitSlop={8} style={{ marginRight: spacing.md }}>
          <Text style={{ color: accent, fontWeight: '800', fontSize: font.sizes.xs }}>+ Verse</Text>
        </Pressable>
        <Pressable onPress={() => setAdding(adding === 'song' ? null : 'song')} hitSlop={8}>
          <Text style={{ color: accent, fontWeight: '800', fontSize: font.sizes.xs }}>+ Song</Text>
        </Pressable>
      </View>

      {adding ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={adding === 'verse' ? 'e.g. Isaiah 40:31 — a verse that fed you today' : 'A song title you sang today'}
            placeholderTextColor={colors.textFaint}
            autoFocus
            onSubmitEditing={submit}
            returnKeyType="send"
            style={{ flex: 1, color: colors.text, fontSize: font.sizes.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm }}
          />
          <Pressable onPress={submit} disabled={!draft.trim()} hitSlop={6} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: draft.trim() ? accent : colors.surfaceAlt }}>
            <Ionicons name="arrow-up" size={17} color={draft.trim() ? colors.onPrimary : colors.textFaint} />
          </Pressable>
        </View>
      ) : null}

      {shares.length === 0 && !adding ? (
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
          Bring a verse or song from your own devotion — your partner can take it into theirs.
        </Text>
      ) : null}

      {[...others, ...(mine ? [mine] : [])].map((s) => {
        const isMe = s.by === myId;
        return (
          <View key={s.by} style={{ gap: 4 }}>
            <Text style={{ color: colors.textFaint, fontSize: 10, fontWeight: '800' }}>{isMe ? 'YOU BROUGHT' : `${(s.byName || 'A PARTNER').toUpperCase()} BROUGHT`}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {s.verses.map((ref) => (
                <View key={ref} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingLeft: spacing.sm, paddingRight: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
                  <PeekableRef reference={ref} tone="plain" />
                  {!isMe ? (
                    <Pressable onPress={() => onAdoptVerse(ref)} hitSlop={6}>
                      <Ionicons name="add-circle" size={16} color={colors.success} />
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => shareDailyItem(code, day, 'verse', ref, true).catch(() => {})} hitSlop={6}>
                      <Ionicons name="close-circle" size={15} color={colors.textFaint} />
                    </Pressable>
                  )}
                </View>
              ))}
              {s.songs.map((title) => (
                <View key={title} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingLeft: spacing.sm, paddingRight: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
                  <Pressable onPress={() => onOpenSong(title)}>
                    <Text style={{ color: colors.accent, fontWeight: '700', fontSize: font.sizes.xs }}>🎵 {title}</Text>
                  </Pressable>
                  {isMe ? (
                    <Pressable onPress={() => shareDailyItem(code, day, 'song', title, true).catch(() => {})} hitSlop={6}>
                      <Ionicons name="close-circle" size={15} color={colors.textFaint} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
            {!isMe && (s.verses.length + s.songs.length) > 0 ? (
              <Pressable onPress={() => onDiscuss(`${s.byName || 'partner'}'s devotion · ${day}`)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Talk about it</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function DailyRow({ icon, tint, label, children }: { icon: keyof typeof Ionicons.glyphMap; tint: string; label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
      <View style={{ width: 26, alignItems: 'center', paddingTop: 2 }}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
        {children}
      </View>
    </View>
  );
}

function PresenceRow({ members, doneIds, accent }: { members: CircleMember[]; doneIds: string[]; accent: string }) {
  const { colors } = useTheme();
  const done = new Set(doneIds);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {members.map((m) => {
        const isDone = done.has(m.id);
        const initial = (m.displayName || '?').trim().charAt(0).toUpperCase();
        return (
          <View key={m.id} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: isDone ? accent : colors.surfaceAlt, borderWidth: isDone ? 0 : 1, borderColor: colors.border }}>
            <Text style={{ color: isDone ? colors.onPrimary : colors.textFaint, fontWeight: '800', fontSize: font.sizes.xs }}>{initial}</Text>
          </View>
        );
      })}
      <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs, marginLeft: 4 }}>
        {doneIds.length} of {members.length} met with Him today
      </Text>
    </View>
  );
}

const FIELDS: { key: keyof CircleDaily; label: string; placeholder: string; multi?: boolean }[] = [
  { key: 'song', label: 'Song', placeholder: 'A hymn/song title to sing together' },
  { key: 'reading', label: 'Reading', placeholder: 'A passage, e.g. Psalm 23 (blank = use the plan)' },
  { key: 'verse', label: 'Verse to carry', placeholder: 'e.g. John 15:5' },
  { key: 'prayer', label: 'Prayer', placeholder: 'A prayer prompt for the day', multi: true },
  { key: 'note', label: 'Theme / note', placeholder: 'A word for the day (optional)', multi: true },
];

function DailyEditor({ code, day, initial, onDone }: { code: string; day: string; initial: any; onDone: () => void }) {
  const { colors } = useTheme();
  const setCircleDaily = useStore((s) => s.setCircleDaily);
  const [draft, setDraft] = useState<CircleDaily>({
    song: initial?.song ?? '',
    reading: initial?.reading ?? '',
    verse: initial?.verse ?? '',
    prayer: initial?.prayer ?? '',
    note: initial?.note ?? '',
  });

  const save = () => {
    setCircleDaily(code, day, draft);
    onDone();
  };

  return (
    <View style={{ gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}>
      <SectionTitle style={{ marginBottom: 0 }}>Set today’s devotional</SectionTitle>
      {FIELDS.map((f) => (
        <View key={f.key} style={{ gap: 4 }}>
          <Text style={{ color: colors.textFaint, fontSize: 10, fontWeight: '800' }}>{f.label.toUpperCase()}</Text>
          <TextInput
            value={(draft[f.key] as string) ?? ''}
            onChangeText={(t) => setDraft((d) => ({ ...d, [f.key]: t }))}
            placeholder={f.placeholder}
            placeholderTextColor={colors.textFaint}
            multiline={f.multi}
            style={{ color: colors.text, fontSize: font.sizes.sm, backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm, minHeight: f.multi ? 52 : undefined }}
          />
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={onDone} />
        <Button title="Save today" small style={{ flex: 1 }} onPress={save} />
      </View>
      <Text style={{ color: colors.textFaint, fontSize: 10 }}>Leave a field blank to clear it. Anyone in the circle can set the day.</Text>
    </View>
  );
}

function ReflectionComposer({ code, day, mine, onDone }: { code: string; day: string; mine: string; onDone: () => void }) {
  const { colors } = useTheme();
  const shareCircleReflection = useStore((s) => s.shareCircleReflection);
  const [text, setText] = useState(mine);

  return (
    <View style={{ gap: spacing.sm }}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="What did the Lord show you today? (shared with your circle)"
        placeholderTextColor={colors.textFaint}
        multiline
        autoFocus
        textAlignVertical="top"
        style={{ color: colors.text, fontSize: font.sizes.sm, minHeight: 70, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, fontFamily: font.serif, lineHeight: 22 }}
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {mine ? (
          <Button title="Unshare" variant="ghost" small style={{ flex: 1 }} onPress={() => { shareCircleReflection(code, day, ''); onDone(); }} />
        ) : (
          <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={onDone} />
        )}
        <Button title={mine ? 'Update' : 'Share'} small style={{ flex: 1 }} disabled={!text.trim()} onPress={() => { shareCircleReflection(code, day, text); onDone(); }} />
      </View>
    </View>
  );
}
