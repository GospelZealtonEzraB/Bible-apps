import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, InteractionManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, EmptyState } from '@/components/ui';
import { VerseActionSheet } from '@/components/VerseActionSheet';
import { useTheme, spacing, font, radius } from '@/theme';
import { searchScripture, type SearchResult } from '@/data/search';
import { useStore } from '@/store/useStore';

export default function SearchScreen() {
  const { colors } = useTheme();
  const serverUrl = useStore((s) => s.settings.serverUrl);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [source, setSource] = useState<'local' | 'semantic'>('local');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);

  const run = () => {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    setResults(null);
    // Defer so the spinner paints before the (first-time) index build blocks.
    InteractionManager.runAfterInteractions(async () => {
      const res = await searchScripture(q, { serverUrl });
      setResults(res.results);
      setSource(res.source);
      setLoading(false);
    });
  };

  return (
    <Screen>
      <Header title="Search" subtitle="Find verses in the KJV" back />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Words or a phrase, e.g. “fear not”"
          placeholderTextColor={colors.textFaint}
          returnKeyType="search"
          onSubmitEditing={run}
          autoFocus
          style={{ flex: 1, color: colors.text, fontSize: font.sizes.md }}
        />
        {query ? (
          <Pressable onPress={() => { setQuery(''); setResults(null); }} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </Card>

      <Button title="Search" icon={<Ionicons name="search" size={16} color={colors.onPrimary} />} onPress={run} disabled={query.trim().length < 2} />

      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
        Keyword search runs fully offline. Meaning-based search (find a verse by its idea) is coming next.
      </Text>

      {loading ? (
        <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {results && results.length === 0 ? (
        <EmptyState emoji="🔎" title="No matches" subtitle="Try fewer or different words. Meaning-based search (coming soon) will find verses even when the words don’t match." />
      ) : null}

      {results && results.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs, fontWeight: '700' }}>
            {results.length} result{results.length === 1 ? '' : 's'} · {source === 'semantic' ? '✨ meaning-based' : 'keyword'}
          </Text>
          {results.map((r) => (
            <Pressable
              key={`${r.bookNumber}-${r.chapter}-${r.verse}`}
              onPress={() => setSelected(r)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
                gap: 4,
              })}
            >
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.sm }}>{r.reference}</Text>
              <Text numberOfLines={3} style={{ color: colors.text, fontSize: font.sizes.sm, lineHeight: 22, fontFamily: font.serif }}>
                {r.text}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <VerseActionSheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        reference={selected?.reference ?? ''}
        text={selected?.text ?? ''}
        translation="kjv"
      />
    </Screen>
  );
}
