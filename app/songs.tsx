import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Image, ActivityIndicator, Linking, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Header } from '@/components/layout';
import { Card, Chip, EmptyState } from '@/components/ui';
import { VersePeek } from '@/components/VersePeek';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore } from '@/store/useStore';
import { searchSongs, songLinks, type SongHit } from '@/data/geniusClient';
import { fetchChords, fetchVersesForSong } from '@/data/aiClient';
import { parseReference, formatReference } from '@/data/books';

interface ChordState { loading?: boolean; text?: string; error?: string }
interface VerseState { loading?: boolean; refs?: string[]; error?: string }

export default function SongsScreen() {
  const { colors } = useTheme();
  const serverUrl = useStore((s) => s.settings.serverUrl);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chords, setChords] = useState<Record<number, ChordState>>({});
  const [verses, setVerses] = useState<Record<number, VerseState>>({});
  const [peek, setPeek] = useState<string | null>(null);

  const getChords = async (s: SongHit) => {
    setChords((c) => ({ ...c, [s.id]: { loading: true } }));
    try {
      const text = await fetchChords(serverUrl, s.title, s.artist);
      setChords((c) => ({ ...c, [s.id]: { text } }));
    } catch (e) {
      setChords((c) => ({ ...c, [s.id]: { error: e instanceof Error ? e.message : 'Failed' } }));
    }
  };

  const getVerses = async (s: SongHit) => {
    setVerses((v) => ({ ...v, [s.id]: { loading: true } }));
    try {
      const raw = await fetchVersesForSong(serverUrl, s.title, s.artist);
      // Validate against the canonical book table — drop hallucinated references.
      const refs = Array.from(new Set(raw.map((x) => { const p = parseReference(x); return p ? formatReference(p) : null; }).filter((x): x is string => !!x)));
      setVerses((v) => ({ ...v, [s.id]: { refs } }));
    } catch (e) {
      setVerses((v) => ({ ...v, [s.id]: { error: e instanceof Error ? e.message : 'Failed' } }));
    }
  };

  const run = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    setResults(null);
    setError(null);
    try {
      setResults(await searchSongs(serverUrl, q));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const open = (url: string) => Linking.openURL(url);

  const renderItem = ({ item: s }: { item: SongHit }) => (
    <Card style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm }}>
      {s.thumbnail ? (
        <Image source={{ uri: s.thumbnail }} style={{ width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }} />
      ) : (
        <View style={{ width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="musical-note" size={22} color={colors.textFaint} />
        </View>
      )}
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }} numberOfLines={2}>{s.title}</Text>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }} numberOfLines={1}>{s.artist}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 }}>
          <LinkChip icon="document-text-outline" label="Lyrics" onPress={() => open(s.url)} />
          <LinkChip icon="book-outline" label="Related verses" onPress={() => getVerses(s)} />
          <LinkChip icon="sparkles-outline" label="AI chords" onPress={() => getChords(s)} />
          <LinkChip icon="logo-youtube" label="Listen" onPress={() => open(songLinks.listen(s.title, s.artist))} />
        </View>
        {verses[s.id] ? <VerseResult state={verses[s.id]} onPeek={setPeek} /> : null}
        {chords[s.id] ? <ChordResult state={chords[s.id]} /> : null}
      </View>
    </Card>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Header title="Worship songs" subtitle="Search · lyrics & chords open on the web" back />
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Song or artist — e.g. “Goodness of God”"
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
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
          Lyrics and chords are copyrighted, so they open on the web (Genius / the artist's page) — never copied into the app.
        </Text>
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : null}
      {error ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <EmptyState emoji="🎵" title="Couldn’t search songs" subtitle={error.includes('not configured') ? 'Song search needs the Genius token set on your server (see setup).' : error} />
        </View>
      ) : null}
      {results && results.length === 0 ? (
        <EmptyState emoji="🔎" title="No songs found" subtitle="Try the song title with the artist." />
      ) : null}

      <FlatList
        data={results ?? []}
        keyExtractor={(s) => String(s.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      />

      <VersePeek reference={peek} onClose={() => setPeek(null)} />
    </SafeAreaView>
  );
}

function VerseResult({ state, onPeek }: { state: VerseState; onPeek: (ref: string) => void }) {
  const { colors } = useTheme();
  if (state.loading) return <ActivityIndicator color={colors.primary} style={{ alignSelf: 'flex-start', marginTop: spacing.sm }} />;
  if (state.error) return <Text style={{ color: colors.warning, fontSize: font.sizes.xs, marginTop: spacing.sm }}>{state.error.includes('Server URL') || state.error.includes('not configured') ? 'AI needs your Server URL in Settings.' : state.error}</Text>;
  if (!state.refs) return null;
  if (state.refs.length === 0) return <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: spacing.sm }}>No clear Scripture references found for this song.</Text>;
  return (
    <View style={{ marginTop: spacing.sm, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="book-outline" size={13} color={colors.textFaint} />
        <Text style={{ color: colors.textFaint, fontSize: 11, fontWeight: '700' }}>Verses behind it — tap to read. AI-suggested; verify.</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {state.refs.map((r) => <Chip key={r} label={r} onPress={() => onPeek(r)} />)}
      </View>
    </View>
  );
}

function ChordResult({ state }: { state: ChordState }) {
  const { colors } = useTheme();
  if (state.loading) return <ActivityIndicator color={colors.primary} style={{ alignSelf: 'flex-start', marginTop: spacing.sm }} />;
  if (state.error) return <Text style={{ color: colors.warning, fontSize: font.sizes.xs, marginTop: spacing.sm }}>{state.error.includes('not configured') || state.error.includes('Server URL') ? 'AI needs your Server URL in Settings.' : state.error}</Text>;
  if (!state.text) return null;
  return (
    <View style={{ marginTop: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="warning-outline" size={13} color={colors.warning} />
        <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '700' }}>AI-suggested — may be wrong. Verify with the official chart.</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: font.sizes.sm, lineHeight: 22, fontFamily: font.serif }}>{state.text}</Text>
    </View>
  );
}

function LinkChip({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
      <Ionicons name={icon} size={13} color={colors.primary} />
      <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
