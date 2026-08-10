import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '@/components/layout';
import { Card, Chip, EmptyState } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useDocList, useStore } from '@/store/useStore';
import { docPreview, docPlainText } from '@/utils/blocks';
import { relativeTimeAgo } from '@/utils/date';
import type { Doc, DocType } from '@/types';

const TYPE_ICON: Record<DocType, keyof typeof Ionicons.glyphMap> = {
  journal: 'book-outline',
  study: 'sparkles-outline',
  verse: 'bookmark-outline',
  topic: 'pricetag-outline',
  sermon: 'mic-outline',
  article: 'newspaper-outline',
  note: 'document-text-outline',
};

const FILTERS: { key: DocType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'note', label: 'Notes' },
  { key: 'journal', label: 'Journal' },
  { key: 'study', label: 'Study' },
  { key: 'sermon', label: 'Sermons' },
  { key: 'article', label: 'Articles' },
  { key: 'topic', label: 'Topics' },
];

export default function NotesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const all = useDocList();
  const createDoc = useStore((s) => s.createDoc);

  const [filter, setFilter] = useState<DocType | 'all'>('all');
  const [query, setQuery] = useState('');

  const docs = useMemo(() => {
    let list = filter === 'all' ? all : all.filter((d) => d.type === filter);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((d) => docPlainText(d).toLowerCase().includes(q));
    return list;
  }, [all, filter, query]);

  const newNote = () => {
    const id = createDoc('note');
    router.push(`/notes/${id}`);
  };

  const renderItem = ({ item: d }: { item: Doc }) => (
    <Card onPress={() => router.push(`/notes/${d.id}`)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
        <Ionicons name={TYPE_ICON[d.type] ?? 'document-text-outline'} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>
            {d.title.trim() || 'Untitled'}
          </Text>
          {d.shared ? <Ionicons name="people" size={13} color={colors.primary} /> : null}
        </View>
        {docPreview(d) ? (
          <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 20, marginTop: 2 }}>{docPreview(d)}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{relativeTimeAgo(d.updatedAt)}</Text>
          {d.tags.slice(0, 3).map((t) => (
            <Text key={t} style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>#{t}</Text>
          ))}
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md }}>
        <Header title="Notes" subtitle="Journal · study · sermons · articles — one place" back right={
          <Pressable onPress={newNote} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primary }}>
            <Ionicons name="add" size={16} color={colors.onPrimary} />
            <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: font.sizes.sm }}>New</Text>
          </Pressable>
        } />

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your notes"
            placeholderTextColor={colors.textFaint}
            style={{ flex: 1, color: colors.text, fontSize: font.sizes.md }}
          />
          {query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.textFaint} /></Pressable> : null}
        </Card>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </View>
      </View>

      {docs.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <EmptyState
            emoji="📝"
            title={query || filter !== 'all' ? 'Nothing here yet' : 'Your writing lives here'}
            subtitle={query || filter !== 'all' ? 'Try a different filter or search.' : 'Journal entries, study notes, sermon prep, and articles — all in one linked place. Tap New to begin.'}
          />
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(d) => d.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}
