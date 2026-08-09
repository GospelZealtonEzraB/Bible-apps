import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Chip, StatusBadge, EmptyState, Button } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { JourneyMap } from '@/components/JourneyMap';
import { useTheme, spacing, font, radius } from '@/theme';
import { useVerseList, useStore } from '@/store/useStore';
import { EmberTip } from '@/components/EmberGuide';
import { usePaged, PageMore } from '@/components/Paginated';
import { isDue } from '@/srs/sm2';
import { relativeDueLabel } from '@/utils/date';
import type { Verse } from '@/types';

type ViewMode = 'list' | 'journey';

type Filter = 'all' | 'due' | 'learning' | 'memorized';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'due', label: 'Due' },
  { key: 'learning', label: 'Learning' },
  { key: 'memorized', label: 'Memorized' },
];

export default function LibraryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const verses = useVerseList();
  const removeVerse = useStore((s) => s.removeVerse);
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<ViewMode>('list');

  const openVerse = (id: string) => router.push(`/verse/${encodeURIComponent(id)}`);

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
      <Header
        title="Library"
        subtitle={`${verses.length} verse${verses.length === 1 ? '' : 's'} saved`}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Pressable
              onPress={() => router.push('/topics')}
              hitSlop={12}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}
            >
              <Ionicons name="pricetag-outline" size={16} color={colors.warning} />
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.sm }}>Topics</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/quiz')}
              hitSlop={12}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primarySoft }}
            >
              <Ionicons name="game-controller-outline" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.sm }}>Quiz</Text>
            </Pressable>
          </View>
        }
      />

      <EmberTip topic="memorize" />

      {/* List / Journey toggle */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.pill,
          padding: 4,
        }}
      >
        {(['list', 'journey'] as ViewMode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setView(m)}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: radius.pill,
              alignItems: 'center',
              backgroundColor: view === m ? colors.primary : 'transparent',
            }}
          >
            <Text style={{ color: view === m ? colors.onPrimary : colors.textMuted, fontWeight: '700' }}>
              {m === 'list' ? 'List' : 'Journey'}
            </Text>
          </Pressable>
        ))}
      </View>

      {view === 'journey' ? (
        verses.length === 0 ? (
          <Card>
            <EmptyState
              emoji="🗺️"
              title="Your journey starts here"
              subtitle="Add verses and watch them climb the path as you master them."
              action={<Button title="Add a verse" onPress={() => router.push('/add')} />}
            />
          </Card>
        ) : (
          <JourneyMap verses={[...verses].reverse()} onSelect={openVerse} />
        )
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {FILTERS.map((f) => (
              <Chip
                key={f.key}
                label={f.label}
                active={filter === f.key}
                onPress={() => setFilter(f.key)}
              />
            ))}
          </ScrollView>

          {filtered.length === 0 ? (
        <Card>
          <EmptyState
            emoji={verses.length === 0 ? '📖' : '🔍'}
            title={verses.length === 0 ? 'Your library is empty' : 'Nothing here yet'}
            subtitle={
              verses.length === 0
                ? 'Add verses to start building your memory collection.'
                : 'No verses match this filter.'
            }
            action={
              verses.length === 0 ? (
                <Button title="Add a verse" onPress={() => router.push('/add')} />
              ) : undefined
            }
          />
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {versePage.shown.map((v) => (
            <Card
              key={v.id}
              onPress={() => router.push(`/verse/${encodeURIComponent(v.id)}`)}
              style={{ paddingVertical: spacing.md }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <ProgressRing progress={v.mastery} size={46} stroke={5} label={`${v.mastery}`} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>
                    {v.reference}
                  </Text>
                  <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
                    {v.text}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 }}>
                    <StatusBadge status={v.status} />
                    <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
                      {relativeDueLabel(v.srs.dueDate)}
                    </Text>
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
        </>
      )}
    </Screen>
  );
}
