import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui';
import { useTheme, spacing, font } from '@/theme';
import { useStore } from '@/store/useStore';
import { verseId } from '@/data/bibleApi';
import { parsePassage } from '@/data/books';
import type { LogEntry, LogKind } from '@/types';

const KIND_META: Record<LogKind, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  verse: { icon: 'bookmark-outline', label: 'Verse' },
  passage: { icon: 'book-outline', label: 'Read' },
  note: { icon: 'document-text-outline', label: 'Note' },
  song: { icon: 'musical-notes-outline', label: 'Song' },
  teaching: { icon: 'mic-outline', label: 'Teaching' },
  topic: { icon: 'pricetag-outline', label: 'Topic' },
  text: { icon: 'chatbox-ellipses-outline', label: '' },
};

/**
 * One line of a day's log. Tapping opens whatever it points at; the row is
 * read-only when it belongs to your partner.
 */
export function LogEntryRow({ entry, readOnly = false }: { entry: LogEntry; readOnly?: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const removeLogEntry = useStore((s) => s.removeLogEntry);
  const setLogEntryPrivate = useStore((s) => s.setLogEntryPrivate);

  const meta = KIND_META[entry.kind] ?? KIND_META.text;

  const open = () => {
    switch (entry.kind) {
      case 'verse': {
        if (!entry.ref) return;
        router.push(`/verse/${encodeURIComponent(verseId(entry.ref, 'kjv'))}`);
        return;
      }
      case 'passage': {
        const p = entry.ref ? parsePassage(entry.ref) : null;
        if (p) router.push(`/read/${p.bookNumber}/${p.chapter}`);
        return;
      }
      case 'note':
      case 'teaching':
        if (entry.assetId) router.push(`/notes/${entry.assetId}`);
        return;
      case 'song':
        if (entry.assetId) router.push(`/songbook/${entry.assetId}`);
        return;
      case 'topic':
        if (entry.assetId) router.push(`/topics/${entry.assetId}`);
        return;
      default:
    }
  };

  const options = () => {
    if (readOnly) return;
    Alert.alert(entry.title || meta.label || 'Log entry', undefined, [
      {
        text: entry.private ? 'Let my partner see it' : 'Keep this private',
        onPress: () => setLogEntryPrivate(entry.id, !entry.private),
      },
      { text: 'Remove from log', style: 'destructive', onPress: () => removeLogEntry(entry.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // A free line reads as writing, not as a card with a chevron.
  if (entry.kind === 'text') {
    return (
      <Pressable onLongPress={options} delayLongPress={300}>
        <Card style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 23 }}>{entry.text}</Text>
          {entry.private ? <PrivateTag /> : null}
        </Card>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={open} onLongPress={options} delayLongPress={300}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={meta.icon} size={17} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }} numberOfLines={1}>
            {entry.title || entry.ref || meta.label}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{meta.label}</Text>
            {entry.private ? <PrivateTag /> : null}
          </View>
          {entry.text ? (
            <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 20 }}>
              {entry.text}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
      </Card>
    </Pressable>
  );
}

function PrivateTag() {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name="lock-closed" size={10} color={colors.textFaint} />
      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>Private</Text>
    </View>
  );
}
