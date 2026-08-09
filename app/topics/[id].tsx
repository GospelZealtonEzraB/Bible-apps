import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, EmptyState } from '@/components/ui';
import { VerseActionSheet } from '@/components/VerseActionSheet';
import { useTheme, spacing, font, radius } from '@/theme';
import { useTopic, useStore } from '@/store/useStore';
import { sortedEntries, type TopicOrder } from '@/utils/topics';
import { hydrateReference } from '@/data/localSearch';
import { translationName as translationNameOf, type FetchedVerse } from '@/data/bibleApi';
import type { TopicEntry } from '@/types';

export default function TopicDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const topic = useTopic(id);
  const updateTopic = useStore((s) => s.updateTopic);
  const deleteTopic = useStore((s) => s.deleteTopic);
  const removeFromTopic = useStore((s) => s.removeFromTopic);
  const setTopicEntryNote = useStore((s) => s.setTopicEntryNote);
  const addFetchedVerse = useStore((s) => s.addFetchedVerse);
  const hasVerse = useStore((s) => s.hasVerse);

  const [order, setOrder] = useState<TopicOrder>('canonical');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [selected, setSelected] = useState<{ reference: string; text: string } | null>(null);

  const entries = useMemo(() => (topic ? sortedEntries(topic, order) : []), [topic, order]);

  if (!topic) {
    return (
      <Screen>
        <Header title="Topic" back />
        <EmptyState emoji="🔎" title="Topic not found" subtitle="It may have been deleted." />
      </Screen>
    );
  }

  const saveTitle = () => {
    const t = titleDraft.trim();
    if (t) updateTopic(topic.id, t, topic.description);
    setEditingTitle(false);
  };

  const confirmDelete = () => {
    Alert.alert('Delete topic', `Delete “${topic.title}” and its ${(topic.entries ?? []).length} tagged ${(topic.entries ?? []).length === 1 ? 'verse' : 'verses'}? Your memorized verses stay in your library.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteTopic(topic.id); router.back(); } },
    ]);
  };

  const openVerse = (entry: TopicEntry) => {
    const hit = hydrateReference(entry.ref);
    setSelected({ reference: entry.ref, text: hit?.text ?? '' });
  };

  // Add every tagged verse to the memory library (KJV text hydrated locally).
  const memorizeAll = () => {
    let added = 0;
    let skipped = 0;
    for (const e of topic.entries ?? []) {
      const hit = hydrateReference(e.ref);
      if (!hit) { skipped++; continue; }
      const fetched: FetchedVerse = { reference: hit.reference, text: hit.text, translation: 'kjv', translationName: translationNameOf('kjv'), offline: true };
      const before = hasVerse(`kjv:${e.ref.trim().toLowerCase()}`);
      addFetchedVerse(fetched);
      if (!before) added++;
    }
    Alert.alert(
      'Added to your library 💛',
      `${added} ${added === 1 ? 'verse' : 'verses'} added to memorize.${skipped ? ` ${skipped} couldn’t be loaded offline.` : ''}`,
    );
  };

  const count = (topic.entries ?? []).length;

  return (
    <Screen>
      <Header
        title={topic.title}
        subtitle={`${count} ${count === 1 ? 'verse' : 'verses'} · private`}
        back
        right={
          <Pressable onPress={confirmDelete} hitSlop={10} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        }
      />

      {editingTitle ? (
        <Card style={{ gap: spacing.sm }}>
          <TextInput
            value={titleDraft}
            onChangeText={setTitleDraft}
            autoFocus
            onSubmitEditing={saveTitle}
            style={{ color: colors.text, fontSize: font.sizes.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Cancel" variant="secondary" onPress={() => setEditingTitle(false)} style={{ flex: 1 }} />
            <Button title="Save" onPress={saveTitle} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Memorize all" onPress={memorizeAll} icon={<Ionicons name="sparkles" size={16} color={colors.onPrimary} />} style={{ flex: 1 }} small />
          <Button title="Rename" variant="secondary" onPress={() => { setTitleDraft(topic.title); setEditingTitle(true); }} icon={<Ionicons name="pencil" size={15} color={colors.text} />} style={{ flex: 1 }} small />
        </View>
      )}

      {count > 1 ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Chip label="Bible order" active={order === 'canonical'} onPress={() => setOrder('canonical')} />
          <Chip label="Recently added" active={order === 'added'} onPress={() => setOrder('added')} />
        </View>
      ) : null}

      {count === 0 ? (
        <EmptyState
          emoji="📖"
          title="No verses yet"
          subtitle="As you read, tap ‘Add to a topic’ on any verse to collect it into this thread."
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {entries.map((e) => (
            <TopicEntryRow
              key={e.ref}
              entry={e}
              onOpen={() => openVerse(e)}
              onRemove={() => removeFromTopic(topic.id, e.ref)}
              onSaveNote={(note) => setTopicEntryNote(topic.id, e.ref, note)}
            />
          ))}
        </View>
      )}

      <VerseActionSheet visible={!!selected} onClose={() => setSelected(null)} reference={selected?.reference ?? ''} text={selected?.text ?? ''} translation="kjv" />
    </Screen>
  );
}

function TopicEntryRow({
  entry,
  onOpen,
  onRemove,
  onSaveNote,
}: {
  entry: TopicEntry;
  onOpen: () => void;
  onRemove: () => void;
  onSaveNote: (note: string) => void;
}) {
  const { colors } = useTheme();
  const hit = useMemo(() => hydrateReference(entry.ref), [entry.ref]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.note ?? '');

  const save = () => { onSaveNote(draft); setEditing(false); };

  return (
    <Card style={{ gap: spacing.sm }}>
      <Pressable onPress={onOpen}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.sm }}>{entry.ref}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
        </View>
        {hit ? (
          <Text numberOfLines={3} style={{ color: colors.text, fontSize: font.sizes.sm, lineHeight: 22, fontFamily: font.serif, marginTop: 4 }}>{hit.text}</Text>
        ) : (
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: 4 }}>Tap to open</Text>
        )}
      </Pressable>

      {editing ? (
        <View style={{ gap: spacing.sm }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Why this verse fits…"
            placeholderTextColor={colors.textFaint}
            multiline
            autoFocus
            textAlignVertical="top"
            style={{ color: colors.text, fontSize: font.sizes.sm, minHeight: 54, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable onPress={() => { setDraft(entry.note ?? ''); setEditing(false); }} style={{ flex: 1, paddingVertical: spacing.sm, alignItems: 'center' }}>
              <Text style={{ color: colors.textFaint, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} style={{ flex: 1, paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md }}>
              <Text style={{ color: colors.onPrimary, fontWeight: '800' }}>Save note</Text>
            </Pressable>
          </View>
        </View>
      ) : entry.note ? (
        <Pressable onPress={() => { setDraft(entry.note ?? ''); setEditing(true); }} style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, fontStyle: 'italic' }}>“{entry.note}”</Text>
        </Pressable>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        {!editing && !entry.note ? (
          <Pressable onPress={() => { setDraft(''); setEditing(true); }} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="create-outline" size={15} color={colors.textFaint} />
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>Add note</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onRemove} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="remove-circle-outline" size={15} color={colors.textFaint} />
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>Remove</Text>
        </Pressable>
      </View>
    </Card>
  );
}
