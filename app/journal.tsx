import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle, EmptyState } from '@/components/ui';
import { RefText } from '@/components/RefText';
import { PeekableRef } from '@/components/PeekableRef';
import { Ember } from '@/components/Ember';
import { usePaged, PageMore } from '@/components/Paginated';
import { useTheme, spacing, font, radius } from '@/theme';
import { useJournal, useStore } from '@/store/useStore';
import { dayKey } from '@/utils/date';
import { journalDays, journalStreak, onThisDay, streakLabel } from '@/utils/journal';
import type { JournalEntry } from '@/types';

/** Pretty, human day label for a YYYY-MM-DD key ("Today", "Yesterday", or a date). */
function dayLabel(day: string, today: string): string {
  if (day === today) return 'Today';
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const ykey = dayKey(dt.getTime() + 24 * 60 * 60 * 1000);
  if (ykey === today) return 'Yesterday';
  return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: dt.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/** Compose a day's journal into shareable text. */
function composeDay(e: JournalEntry, today: string): string {
  const lines: string[] = [dayLabel(e.day, today)];
  if (e.verse) lines.push(`Verse carried: ${e.verse}`);
  if (e.reflection) lines.push('', e.reflection);
  if (e.gratitude) lines.push('', `Grateful for: ${e.gratitude}`);
  if (e.notes?.length) {
    lines.push('', 'Notes:');
    for (const n of e.notes) lines.push(`• ${n.ref ? n.ref + ' — ' : ''}${n.text}`);
  }
  lines.push('', '— journaled in Versed');
  return lines.join('\n');
}

export default function JournalScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const journal = useJournal();
  const today = dayKey();

  const days = useMemo(() => journalDays(journal), [journal]);
  const past = useMemo(() => days.filter((e) => e.day !== today), [days, today]);
  const streak = useMemo(() => journalStreak(journal, today), [journal, today]);
  const memories = useMemo(() => onThisDay(journal, today), [journal, today]);
  const pastPage = usePaged(past, 10, past.length);

  const shareDay = async (e: JournalEntry) => {
    try { await Share.share({ message: composeDay(e, today) }); } catch {}
  };

  return (
    <Screen>
      <Header title="Journal" subtitle="Your days with Him — private to you" back />

      {/* Streak / heart */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Ember mood={streak > 0 ? 'celebrating' : 'content'} size={54} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.lg }}>{streakLabel(streak)}</Text>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: 2 }}>
            {days.length === 0 ? 'Write your first entry below.' : `${days.length} day${days.length === 1 ? '' : 's'} recorded · a living record of your walk.`}
          </Text>
        </View>
      </Card>

      {/* Today's composer */}
      <SectionTitle style={{ marginBottom: 0 }}>Today</SectionTitle>
      <DayEditor day={today} today={today} startOpen />

      {/* On this day */}
      {memories.length > 0 ? (
        <View>
          <SectionTitle>On this day</SectionTitle>
          <View style={{ gap: spacing.sm }}>
            {memories.slice(0, 3).map((e) => (
              <Card key={e.day} style={{ gap: 4, borderLeftWidth: 3, borderLeftColor: colors.accent }}>
                <Text style={{ color: colors.accent, fontSize: font.sizes.xs, fontWeight: '800' }}>{dayLabel(e.day, today)}</Text>
                {e.reflection ? <RefText text={e.reflection} style={{ color: colors.text, fontSize: font.sizes.sm, lineHeight: 22, fontFamily: font.serif }} /> : null}
              </Card>
            ))}
          </View>
        </View>
      ) : null}

      {/* Timeline */}
      {past.length > 0 ? (
        <View>
          <SectionTitle>Earlier days</SectionTitle>
          <View style={{ gap: spacing.sm }}>
            {pastPage.shown.map((e) => (
              <DayCard key={e.day} entry={e} today={today} onShare={() => shareDay(e)} />
            ))}
            <PageMore remaining={pastPage.remaining} step={10} onPress={pastPage.showMore} noun="earlier days" />
          </View>
        </View>
      ) : days.length === 0 ? (
        <EmptyState
          emoji="📔"
          title="Begin your journal"
          subtitle="Each day, record what the Lord showed you, the verse you're carrying, and what you're grateful for. Over time this becomes a treasured record."
        />
      ) : null}

      <Text style={{ color: colors.textFaint, fontSize: 10, textAlign: 'center', marginTop: spacing.sm }}>
        🔒 Your journal lives on your device and in your private backup — never shared unless you choose.
      </Text>
    </Screen>
  );
}

/** A read-only past day, tappable to expand into the full editor. */
function DayCard({ entry, today, onShare }: { entry: JournalEntry; today: string; onShare: () => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  if (open) return <DayEditor day={entry.day} today={today} startOpen onCollapse={() => setOpen(false)} />;

  return (
    <Card style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, color: colors.primary, fontWeight: '800', fontSize: font.sizes.sm }}>{dayLabel(entry.day, today)}</Text>
        <Pressable onPress={onShare} hitSlop={8} style={{ paddingHorizontal: 4 }}><Ionicons name="share-outline" size={16} color={colors.textFaint} /></Pressable>
        <Pressable onPress={() => setOpen(true)} hitSlop={8} style={{ paddingHorizontal: 4 }}><Ionicons name="create-outline" size={16} color={colors.textFaint} /></Pressable>
      </View>
      {entry.verse ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="bookmark-outline" size={13} color={colors.textFaint} />
          <PeekableRef reference={entry.verse} tone="plain" />
        </View>
      ) : null}
      {entry.reflection ? <RefText text={entry.reflection} style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24, fontFamily: font.serif }} /> : null}
      {entry.gratitude ? <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 22 }}>🙏 {entry.gratitude}</Text> : null}
      {entry.notes?.length ? (
        <View style={{ gap: 4, marginTop: 2 }}>
          {entry.notes.map((n) => (
            <View key={n.id} style={{ flexDirection: 'row', gap: 6 }}>
              <Text style={{ color: colors.textFaint }}>•</Text>
              <View style={{ flex: 1 }}>
                {n.ref ? <PeekableRef reference={n.ref} tone="plain" /> : null}
                <RefText text={n.text} style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 21 }} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** The editor for a single day — reflection, verse carried, gratitude, and notes. */
function DayEditor({ day, today, startOpen, onCollapse }: { day: string; today: string; startOpen?: boolean; onCollapse?: () => void }) {
  const { colors } = useTheme();
  const entry = useStore((s) => s.journal[day]);
  const setJournalReflection = useStore((s) => s.setJournalReflection);
  const setJournalVerse = useStore((s) => s.setJournalVerse);
  const setJournalGratitude = useStore((s) => s.setJournalGratitude);
  const addJournalNote = useStore((s) => s.addJournalNote);
  const removeJournalNote = useStore((s) => s.removeJournalNote);

  const [reflection, setReflection] = useState(entry?.reflection ?? '');
  const [verse, setVerse] = useState(entry?.verse ?? '');
  const [gratitude, setGratitude] = useState(entry?.gratitude ?? '');
  const [noteDraft, setNoteDraft] = useState('');

  const input = { color: colors.text, fontSize: font.sizes.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md } as const;

  const saveAll = () => {
    setJournalReflection(day, reflection);
    setJournalVerse(day, verse);
    setJournalGratitude(day, gratitude);
    onCollapse?.();
  };

  const addNote = () => {
    if (!noteDraft.trim()) return;
    addJournalNote({ text: noteDraft }, day);
    setNoteDraft('');
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      {onCollapse ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, color: colors.primary, fontWeight: '800', fontSize: font.sizes.sm }}>{dayLabel(day, today)}</Text>
          <Pressable onPress={onCollapse} hitSlop={8}><Ionicons name="chevron-up" size={18} color={colors.textFaint} /></Pressable>
        </View>
      ) : null}

      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>WHAT HE SHOWED ME</Text>
      <TextInput
        value={reflection}
        onChangeText={setReflection}
        onBlur={() => setJournalReflection(day, reflection)}
        placeholder="Write freely — what did the Lord teach you today?"
        placeholderTextColor={colors.textFaint}
        multiline
        textAlignVertical="top"
        style={{ ...input, minHeight: 96, fontFamily: font.serif, lineHeight: 24 }}
      />

      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700', marginTop: 4 }}>VERSE I'M CARRYING</Text>
      <TextInput
        value={verse}
        onChangeText={setVerse}
        onBlur={() => setJournalVerse(day, verse)}
        placeholder="e.g. Psalm 23:1"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="words"
        style={input}
      />
      {entry?.verse ? (
        <View style={{ flexDirection: 'row' }}>
          <PeekableRef reference={entry.verse} />
        </View>
      ) : null}

      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700', marginTop: 4 }}>GRATEFUL FOR</Text>
      <TextInput
        value={gratitude}
        onChangeText={setGratitude}
        onBlur={() => setJournalGratitude(day, gratitude)}
        placeholder="One thing you're thankful for today…"
        placeholderTextColor={colors.textFaint}
        style={input}
      />

      {/* Notes */}
      {entry?.notes?.length ? (
        <View style={{ gap: 4, marginTop: 4 }}>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>NOTES</Text>
          {entry.notes.map((n) => (
            <View key={n.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <View style={{ flex: 1 }}>
                {n.ref ? <PeekableRef reference={n.ref} tone="plain" /> : null}
                <RefText text={n.text} style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 21 }} />
              </View>
              <Pressable onPress={() => removeJournalNote(day, n.id)} hitSlop={8}><Ionicons name="close" size={15} color={colors.textFaint} /></Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TextInput
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder="Add a quick note…"
          placeholderTextColor={colors.textFaint}
          onSubmitEditing={addNote}
          returnKeyType="done"
          style={{ ...input, flex: 1, paddingVertical: spacing.sm }}
        />
        <Pressable onPress={addNote} disabled={!noteDraft.trim()} hitSlop={6} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: noteDraft.trim() ? colors.primary : colors.surfaceAlt }}>
          <Ionicons name="add" size={20} color={noteDraft.trim() ? colors.onPrimary : colors.textFaint} />
        </Pressable>
      </View>

      {onCollapse ? <Button title="Done" small onPress={saveAll} /> : null}
    </Card>
  );
}
