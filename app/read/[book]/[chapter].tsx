import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Button, Chip, EmptyState } from '@/components/ui';
import { VerseActionSheet } from '@/components/VerseActionSheet';
import { useTheme, spacing, font } from '@/theme';
import { bookByNumber, chapterCount } from '@/data/structure';
import { getChapterVerses, isLatinTranslation, type ChapterVerse } from '@/data/bibleApi';
import { hasLocal } from '@/data/localBible';
import { useSettings, useStore } from '@/store/useStore';

const READER_TRANSLATIONS = [
  { id: 'kjv', label: 'KJV' },
  { id: 'web', label: 'WEB' },
  { id: 'tamil', label: 'தமிழ்' },
];

export default function ChapterReaderScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ book: string; chapter: string }>();
  const bookNumber = Number(params.book);
  const chapter = Number(params.chapter);
  const book = bookByNumber(bookNumber);
  const count = chapterCount(bookNumber);

  const translation = useSettings((s) => s.readerTranslation);
  const setSettings = useStore((s) => s.setSettings);
  const setReadingPosition = useStore((s) => s.setReadingPosition);

  const [verses, setVerses] = useState<ChapterVerse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChapterVerse | null>(null);

  const serif = isLatinTranslation(translation);

  useEffect(() => {
    if (!book) return;
    setReadingPosition(bookNumber, chapter);
    let active = true;
    setLoading(true);
    setError(null);
    setVerses(null);
    getChapterVerses(`${book.name} ${chapter}`, translation)
      .then((r) => active && setVerses(r.verses))
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Could not load this chapter.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [bookNumber, chapter, translation]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!book || count === 0 || chapter < 1 || chapter > count) {
    return (
      <Screen>
        <Header title="Read" back />
        <EmptyState emoji="📖" title="Chapter not found" subtitle="Head back and pick a chapter." />
      </Screen>
    );
  }

  const go = (c: number) => router.replace(`/read/${bookNumber}/${c}`);

  return (
    <Screen>
      <Header title={`${book.name} ${chapter}`} subtitle="Tap a verse to memorize, study, or share" back />

      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
        {READER_TRANSLATIONS.map((t) => (
          <Chip key={t.id} label={t.label} active={t.id === translation} onPress={() => setSettings({ readerTranslation: t.id })} />
        ))}
        {hasLocal(translation) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: font.sizes.xs, fontWeight: '700' }}>Offline</Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {error && !verses ? (
        <EmptyState
          emoji="📖"
          title="Couldn’t load this chapter"
          subtitle={error}
          action={<Button title="Try again" onPress={() => go(chapter)} />}
        />
      ) : null}

      {verses ? (
        <View style={{ gap: spacing.xs }}>
          {verses.map((v) => (
            <Pressable
              key={v.verse}
              onPress={() => setSelected(v)}
              style={({ pressed }) => ({
                borderRadius: 10,
                paddingVertical: 4,
                paddingHorizontal: 6,
                backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
              })}
            >
              <Text style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 28, fontFamily: serif ? font.serif : undefined }}>
                <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>{v.verse} </Text>
                {v.text}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {verses ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Button
            title="Previous"
            variant="secondary"
            small
            style={{ flex: 1 }}
            disabled={chapter <= 1}
            icon={<Ionicons name="chevron-back" size={16} color={colors.text} />}
            onPress={() => go(chapter - 1)}
          />
          <Button
            title="Next"
            variant="secondary"
            small
            style={{ flex: 1 }}
            disabled={chapter >= count}
            onPress={() => go(chapter + 1)}
          />
        </View>
      ) : null}

      <VerseActionSheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        reference={selected ? `${book.name} ${chapter}:${selected.verse}` : ''}
        text={selected?.text ?? ''}
        translation={translation}
      />
    </Screen>
  );
}
