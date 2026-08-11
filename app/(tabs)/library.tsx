import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Chip, StatusBadge, EmptyState, Button } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { useTheme, spacing, font, radius } from '@/theme';
import { useVerseList, useStore, useSongbook, useDocList, useTopicList } from '@/store/useStore';
import { usePaged, PageMore } from '@/components/Paginated';
import { allSongs } from '@/data/songbook';
import { isDue } from '@/srs/sm2';
import { relativeDueLabel } from '@/utils/date';
import type { Verse } from '@/types';

type Filter = 'all' | 'due' | 'learning' | 'memorized';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'due', label: 'Due' },
  { key: 'learning', label: 'Learning' },
  { key: 'memorized', label: 'Memorized' },
];

/**
 * Library — everything that's yours: the verses you're hiding in your heart,
 * your notes, your topics, your songbook, your saved teachings, and one place
 * to practise. Your partner can look through all of it except what you've
 * marked private.
 */
export default function LibraryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const verses = useVerseList();
  const removeVerse = useStore((s) => s.removeVerse);
  const songbook = useSongbook();
  const notes = useDocList({ type: 'note' });
  const studies = useDocList({ type: 'study' });
  const teachings = useDocList({ type: 'sermon' });
  const topics = useTopicList();

  const [filter, setFilter] = useState<Filter>('all');

  const songCount = useMemo(() => allSongs(songbook).length, [songbook]);
  const dueCount = useMemo(() => verses.filter((v) => isDue(v.srs)).length, [verses]);
  const noteCount = notes.length + studies.length;

  const filtered = useMemo(() => {
    switch (filter) {
      case 'due':
        return verses.filter((v) => isDue(v.srs));
      case 'learning':
        return verses.filter((v) => v.status === 'learning' || v.status === 'new' || v.status === 'reviewing');
      case 'memorized':
        return verses.filter((v) => v.status === 'memorized');
      default:
        return verses;
    }
  }, [verses, filter]);

  const versePage = usePaged(filtered, 25, filter);

  const confirmDelete = (v: Verse) => {
    Alert.alert('Remove verse', `Remove ${v.reference} from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeVerse(v.id) },
    ]);
  };

  return (
    <Screen>
      <Header title="Library" subtitle="Everything that's yours" />

      {/* The shelves */}
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Shelf
            icon="document-text-outline"
            color={colors.success}
            title="Notes"
            subtitle={noteCount ? `${noteCount} saved` : 'Write anything'}
            onPress={() => router.push('/notes')}
          />
          <Shelf
            icon="pricetag-outline"
            color={colors.warning}
            title="Topics"
            subtitle={topics.length ? `${topics.length} tags` : 'Group verses'}
            onPress={() => router.push('/topics')}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Shelf
            icon="musical-notes-outline"
            color={colors.accent}
            title="Songbook"
            subtitle={`${songCount} songs`}
            onPress={() => router.push('/songbook')}
          />
          <Shelf
            icon="mic-outline"
            color={colors.primary}
            title="Teachings"
            subtitle={teachings.length ? `${teachings.length} saved` : 'From a message'}
            onPress={() => (teachings.length ? router.push('/notes?type=sermon') : router.push('/sermon'))}
          />
        </View>
      </View>

      {/* Practice — the one place review and the game modes live */}
      <Pressable onPress={() => router.push('/practice')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="repeat" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>Practice</Text>
            <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
              {dueCount > 0 ? `${dueCount} due now` : 'Nothing due — practise anyway'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
        </Card>
      </Pressable>

      {/* The verses themselves */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
      </View>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            emoji={verses.length === 0 ? '📖' : '🔍'}
            title={verses.length === 0 ? 'No verses yet' : 'Nothing here'}
            subtitle={
              verses.length === 0
                ? 'Find a verse while you read and tap “Memorize this verse”.'
                : 'No verses match this filter.'
            }
            action={verses.length === 0 ? <Button title="Open the Bible" onPress={() => router.push('/read')} /> : undefined}
          />
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {versePage.shown.map((v) => (
            <Card key={v.id} onPress={() => router.push(`/verse/${encodeURIComponent(v.id)}`)} style={{ paddingVertical: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <ProgressRing progress={v.mastery} size={46} stroke={5} label={`${v.mastery}`} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>{v.reference}</Text>
                  <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>{v.text}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 }}>
                    <StatusBadge status={v.status} />
                    <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{relativeDueLabel(v.srs.dueDate)}</Text>
                  </View>
                </View>
                <Pressable onPress={() => confirmDelete(v)} hitSlop={10} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={20} color={colors.textFaint} />
                </Pressable>
              </View>
            </Card>
          ))}
          <PageMore remaining={versePage.remaining} step={25} onPress={versePage.showMore} noun="more verses" />
        </View>
      )}
    </Screen>
  );
}

/** One shelf tile in the library's top grid. */
function Shelf({
  icon,
  color,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: 4,
      })}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{title}</Text>
      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }} numberOfLines={1}>{subtitle}</Text>
    </Pressable>
  );
}
