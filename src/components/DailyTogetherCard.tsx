import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card, Button, SectionTitle } from '@/components/ui';
import { RefText } from '@/components/RefText';
import { PeekableRef } from '@/components/PeekableRef';
import { useTheme, spacing, font, radius } from '@/theme';
import { useCircle, useProfile, useStore } from '@/store/useStore';
import { dayKey } from '@/utils/date';
import { parsePassage } from '@/data/books';
import { planPortionForDate } from '@/data/readingPlans';
import { matchHymnByTitle } from '@/data/hymns';
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
  const circle = useCircle(code);
  const profile = useProfile();
  const completeCircleDaily = useStore((s) => s.completeCircleDaily);

  const today = dayKey();
  const day = circle?.daily?.[today];
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
    const hymn = matchHymnByTitle(title);
    if (hymn) router.push(`/hymns/${hymn.id}`);
    else router.push(`/songs?q=${encodeURIComponent(title)}`);
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
              {reflections.map((r) => (
                <View key={r.by} style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, gap: 2 }}>
                  <Text style={{ color: accent, fontWeight: '800', fontSize: font.sizes.xs }}>{r.by === myId ? 'You' : r.byName || 'A partner'}</Text>
                  <RefText text={r.text} style={{ color: colors.text, fontSize: font.sizes.sm, lineHeight: 21, fontFamily: font.serif }} />
                </View>
              ))}
              {reflections.length === 0 && !reflecting ? (
                <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>Be the first to share what He showed you today.</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
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
