import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, spacing, font, radius } from '@/theme';
import { useStore, useDocList, useVerseList } from '@/store/useStore';
import { searchLocalKjv, hydrateReference } from '@/data/localSearch';
import { searchHymns, HYMNS } from '@/data/hymns';
import { parsePassage } from '@/data/books';
import { docPreview } from '@/utils/blocks';
import type { MessageAttachment } from '@/types';

/**
 * The chat's Bible-study palette — fingertip access to your Bible, your verses,
 * your notes, and your songbook, to attach inline in a message. A specialized
 * chat tray for believers who talk Scripture: search the Bible (reference or
 * words), pick from what you're memorizing, share a note, or send a song.
 */
type Tab = 'bible' | 'mine' | 'notes' | 'songs';

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'bible', label: 'Bible', icon: 'book-outline' },
  { key: 'mine', label: 'My verses', icon: 'sparkles-outline' },
  { key: 'notes', label: 'Notes', icon: 'document-text-outline' },
  { key: 'songs', label: 'Songs', icon: 'musical-notes-outline' },
];

export function AttachSheet({
  visible,
  onClose,
  onAttach,
}: {
  visible: boolean;
  onClose: () => void;
  onAttach: (a: MessageAttachment) => void;
}) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('bible');
  const [query, setQuery] = useState('');

  const pick = (a: MessageAttachment) => {
    onAttach(a);
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl, maxHeight: '75%', minHeight: 380 }}>
        {/* Tabs */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => { setTab(t.key); setQuery(''); }}
              style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: tab === t.key ? colors.primarySoft : colors.surfaceAlt }}
            >
              <Ionicons name={t.icon} size={17} color={tab === t.key ? colors.primary : colors.textFaint} />
              <Text style={{ color: tab === t.key ? colors.primary : colors.textFaint, fontSize: 10, fontWeight: '800' }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
          <Ionicons name="search" size={16} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={
              tab === 'bible' ? 'John 3:16, Psalm 23, or words — “be still”' :
              tab === 'mine' ? 'Filter your verses…' :
              tab === 'notes' ? 'Filter your notes…' : 'Find a song…'
            }
            placeholderTextColor={colors.textFaint}
            autoFocus
            style={{ flex: 1, color: colors.text, fontSize: font.sizes.sm, paddingVertical: spacing.sm }}
          />
          {query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={16} color={colors.textFaint} /></Pressable> : null}
        </View>

        {tab === 'bible' ? <BiblePicker query={query} onPick={pick} /> : null}
        {tab === 'mine' ? <MyVersesPicker query={query} onPick={pick} /> : null}
        {tab === 'notes' ? <NotesPicker query={query} onPick={pick} /> : null}
        {tab === 'songs' ? <SongsPicker query={query} onPick={pick} /> : null}
      </View>
    </Modal>
  );
}

function Row({ title, subtitle, icon, onPress }: { title: string; subtitle?: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
      <Ionicons name={icon} size={17} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.sm }}>{title}</Text>
        {subtitle ? <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: font.sizes.xs, lineHeight: 17 }}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="add-circle" size={20} color={colors.success} />
    </Pressable>
  );
}

function Hint({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, textAlign: 'center', marginTop: spacing.lg, lineHeight: 18 }}>{text}</Text>;
}

/** Search the whole (local KJV) Bible by reference or words; attach the verse with its text. */
function BiblePicker({ query, onPick }: { query: string; onPick: (a: MessageAttachment) => void }) {
  const results = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    // A parseable reference wins (verse or chapter start); else word search.
    const p = parsePassage(q);
    if (p) {
      const ref = p.whole ? `${p.bookName} ${p.chapter}:1` : `${p.bookName} ${p.chapter}:${p.verseStart}${p.verseEnd && p.verseEnd !== p.verseStart ? `-${p.verseEnd}` : ''}`;
      const hit = hydrateReference(ref);
      return hit ? [hit] : [];
    }
    return searchLocalKjv(q, 25);
  }, [query]);

  if (query.trim().length < 2) return <Hint text="Type a reference (John 3:16) or search by words — straight from your Bible." />;
  if (results.length === 0) return <Hint text="Nothing found — check the reference or try different words." />;

  return (
    <FlatList
      data={results}
      keyExtractor={(r) => r.reference}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <Row
          icon="book-outline"
          title={item.reference}
          subtitle={item.text}
          onPress={() => onPick({ kind: 'verse', ref: item.reference, text: item.text.slice(0, 500) })}
        />
      )}
    />
  );
}

/** The verses you're hiding in your heart — one tap to bring one into the conversation. */
function MyVersesPicker({ query, onPick }: { query: string; onPick: (a: MessageAttachment) => void }) {
  const verses = useVerseList();
  const q = query.trim().toLowerCase();
  const list = useMemo(
    () => verses.filter((v) => !q || v.reference.toLowerCase().includes(q) || v.text.toLowerCase().includes(q)).slice(0, 50),
    [verses, q],
  );
  if (verses.length === 0) return <Hint text="No verses in your library yet — add some from the Bible tab." />;
  return (
    <FlatList
      data={list}
      keyExtractor={(v) => v.id}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <Row
          icon="sparkles-outline"
          title={item.reference}
          subtitle={item.text}
          onPress={() => onPick({ kind: 'verse', ref: item.reference, text: item.text.slice(0, 500) })}
        />
      )}
    />
  );
}

/** Your notes/journal/study docs — share one as a card (title + preview). */
function NotesPicker({ query, onPick }: { query: string; onPick: (a: MessageAttachment) => void }) {
  const docs = useDocList();
  const q = query.trim().toLowerCase();
  const list = useMemo(
    () => docs.filter((d) => !q || d.title.toLowerCase().includes(q) || docPreview(d).toLowerCase().includes(q)).slice(0, 50),
    [docs, q],
  );
  if (docs.length === 0) return <Hint text="No notes yet — your journal, study notes, and writings will appear here." />;
  return (
    <FlatList
      data={list}
      keyExtractor={(d) => d.id}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <Row
          icon="document-text-outline"
          title={item.title.trim() || 'Untitled note'}
          subtitle={docPreview(item)}
          onPress={() => onPick({ kind: 'note', title: item.title.trim() || 'Untitled note', text: docPreview(item, 400), ref: item.anchorRef })}
        />
      )}
    />
  );
}

/** Your songbook — send a song; it opens with lyrics & chords on their side. */
function SongsPicker({ query, onPick }: { query: string; onPick: (a: MessageAttachment) => void }) {
  const list = useMemo(() => (query.trim().length >= 2 ? searchHymns(query) : HYMNS.slice(0, 25)), [query]);
  if (list.length === 0) return <Hint text="No songs matched — try another title or line." />;
  return (
    <FlatList
      data={list}
      keyExtractor={(h) => h.id}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <Row
          icon="musical-notes-outline"
          title={item.title}
          subtitle={[item.author, item.scriptureRefs?.[0]].filter(Boolean).join(' · ')}
          onPress={() => onPick({ kind: 'song', title: item.title, ref: item.scriptureRefs?.[0] })}
        />
      )}
    />
  );
}
