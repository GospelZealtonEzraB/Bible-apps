import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Button, Chip, EmptyState } from '@/components/ui';
import { VerseActionSheet } from '@/components/VerseActionSheet';
import { AddToTopicSheet } from '@/components/AddToTopicSheet';
import { EmberTip } from '@/components/EmberGuide';
import { useTheme, spacing, font, radius } from '@/theme';
import { bookByNumber, chapterCount } from '@/data/structure';
import { getChapterVerses, isLatinTranslation, translationName, type ChapterVerse } from '@/data/bibleApi';
import { hasLocal } from '@/data/localBible';
import { useSettings, useStore } from '@/store/useStore';

const READER_TRANSLATIONS = [
  { id: 'kjv', label: 'KJV' },
  { id: 'web', label: 'WEB' },
  { id: 'esv', label: 'ESV' },
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
  const serverUrl = useSettings((s) => s.serverUrl);
  const setSettings = useStore((s) => s.setSettings);
  const setReadingPosition = useStore((s) => s.setReadingPosition);

  const [verses, setVerses] = useState<ChapterVerse[] | null>(null);
  const [attribution, setAttribution] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChapterVerse | null>(null);

  // Parallel translations: a second column read alongside the primary.
  const [compareId, setCompareId] = useState<string | null>(null);
  const [compareVerses, setCompareVerses] = useState<ChapterVerse[] | null>(null);
  const comparing = !!compareId && !!compareVerses;
  const compareMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const v of compareVerses ?? []) m.set(v.verse, v.text);
    return m;
  }, [compareVerses]);

  // Multi-select: tag several verses into a topic at once.
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [topicOpen, setTopicOpen] = useState(false);

  const serif = isLatinTranslation(translation);

  const refFor = (n: number) => `${book?.name ?? ''} ${chapter}:${n}`;

  const togglePick = (n: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });

  const enterSelect = (n: number) => {
    setSelectMode(true);
    setPicked(new Set([n]));
  };

  const exitSelect = () => {
    setSelectMode(false);
    setPicked(new Set());
  };

  const pickedRefs = verses
    ? verses.filter((v) => picked.has(v.verse)).map((v) => refFor(v.verse))
    : [];

  useEffect(() => {
    if (!book) return;
    setReadingPosition(bookNumber, chapter);
    let active = true;
    setLoading(true);
    setError(null);
    setVerses(null);
    setAttribution(null);
    setSelectMode(false);
    setPicked(new Set());
    getChapterVerses(`${book.name} ${chapter}`, translation, { serverUrl })
      .then((r) => {
        if (!active) return;
        setVerses(r.verses);
        setAttribution(r.attribution ?? null);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Could not load this chapter.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [bookNumber, chapter, translation, serverUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch the compare translation when one is chosen (or when the chapter changes).
  useEffect(() => {
    if (!book || !compareId) { setCompareVerses(null); return; }
    let active = true;
    setCompareVerses(null);
    getChapterVerses(`${book.name} ${chapter}`, compareId, { serverUrl })
      .then((r) => active && setCompareVerses(r.verses))
      .catch(() => active && setCompareVerses([]));
    return () => { active = false; };
  }, [bookNumber, chapter, compareId, serverUrl]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <View style={{ flex: 1 }}>
    <Screen contentStyle={selectMode ? { paddingBottom: 96 } : undefined}>
      <Header
        title={`${book.name} ${chapter}`}
        subtitle={selectMode ? `${picked.size} selected · tap verses to add` : 'Tap a verse — or Select to collect several'}
        back
        right={
          <Pressable onPress={() => (selectMode ? exitSelect() : setSelectMode(true))} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: selectMode ? colors.primarySoft : colors.surfaceAlt }}>
            <Ionicons name={selectMode ? 'close' : 'checkbox-outline'} size={16} color={selectMode ? colors.primary : colors.text} />
            <Text style={{ color: selectMode ? colors.primary : colors.text, fontWeight: '800', fontSize: font.sizes.sm }}>{selectMode ? 'Cancel' : 'Select'}</Text>
          </Pressable>
        }
      />

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

      {/* Parallel translation picker */}
      {!selectMode ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
          <Ionicons name="git-compare-outline" size={15} color={colors.textFaint} />
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>Compare</Text>
          {READER_TRANSLATIONS.filter((t) => t.id !== translation).map((t) => (
            <Chip key={t.id} label={t.label} active={compareId === t.id} onPress={() => setCompareId((c) => (c === t.id ? null : t.id))} />
          ))}
        </View>
      ) : null}

      <EmberTip topic="reader" />

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

      {verses && !comparing ? (
        <View style={{ gap: spacing.xs }}>
          {verses.map((v) => {
            const isPicked = picked.has(v.verse);
            return (
              <Pressable
                key={v.verse}
                onPress={() => (selectMode ? togglePick(v.verse) : setSelected(v))}
                onLongPress={() => !selectMode && enterSelect(v.verse)}
                delayLongPress={250}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 6,
                  borderRadius: 10,
                  paddingVertical: 4,
                  paddingHorizontal: 6,
                  backgroundColor: isPicked ? colors.primarySoft : pressed ? colors.surfaceAlt : 'transparent',
                })}
              >
                {selectMode ? (
                  <Ionicons
                    name={isPicked ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={isPicked ? colors.primary : colors.textFaint}
                    style={{ marginTop: 5 }}
                  />
                ) : null}
                <Text style={{ flex: 1, color: colors.text, fontSize: font.sizes.md, lineHeight: 28, fontFamily: serif ? font.serif : undefined }}>
                  <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>{v.verse} </Text>
                  {v.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Parallel two-column view */}
      {verses && comparing ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Text style={{ flex: 1, color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '800' }}>{translationName(translation)}</Text>
            <Text style={{ flex: 1, color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '800' }}>{compareId ? translationName(compareId) : ''}</Text>
          </View>
          {verses.map((v) => (
            <Pressable
              key={v.verse}
              onPress={() => setSelected(v)}
              style={({ pressed }) => ({ flexDirection: 'row', gap: spacing.md, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 8, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}
            >
              <Text style={{ flex: 1, color: colors.text, fontSize: font.sizes.sm, lineHeight: 24, fontFamily: serif ? font.serif : undefined }}>
                <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>{v.verse} </Text>{v.text}
              </Text>
              <Text style={{ flex: 1, color: colors.text, fontSize: font.sizes.sm, lineHeight: 24, fontFamily: compareId && isLatinTranslation(compareId) ? font.serif : undefined }}>
                {compareMap.get(v.verse) ?? '…'}
              </Text>
            </Pressable>
          ))}
          {compareVerses && compareVerses.length === 0 ? (
            <Text style={{ color: colors.warning, fontSize: font.sizes.xs }}>Couldn’t load {compareId ? translationName(compareId) : 'that translation'} — it may need a Server URL, or be offline.</Text>
          ) : null}
        </View>
      ) : null}

      {attribution ? (
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: spacing.md, lineHeight: 16 }}>{attribution}</Text>
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

    {/* Floating selection bar — add the whole selection to a topic at once. */}
    {selectMode && picked.size > 0 ? (
      <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
        <Pressable onPress={() => setPicked(new Set())} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
        <Text style={{ flex: 1, color: colors.text, fontWeight: '800', fontSize: font.sizes.sm }}>{picked.size} verse{picked.size === 1 ? '' : 's'} selected</Text>
        <Button title="Add to topic" small onPress={() => setTopicOpen(true)} icon={<Ionicons name="pricetag-outline" size={15} color={colors.onPrimary} />} />
      </View>
    ) : null}

    <AddToTopicSheet visible={topicOpen} onClose={() => { setTopicOpen(false); exitSelect(); }} references={pickedRefs} />
    </View>
  );
}
