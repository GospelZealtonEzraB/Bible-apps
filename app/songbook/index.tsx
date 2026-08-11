import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList, ActivityIndicator, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Header } from '@/components/layout';
import { Card } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore, useSongbook } from '@/store/useStore';
import { allSongs, mySongs, favoriteSongs, matchSongByTitle, isMine, hymnHasChords, type Hymn } from '@/data/songbook';
import { searchSongbook } from '@/data/songSearch';
import { searchSongs, songLinks, type SongHit } from '@/data/geniusClient';
import { EmberTip } from '@/components/EmberGuide';

type Scope = 'all' | 'mine' | 'fav';
type Lang = 'all' | 'en' | 'ta';

/**
 * The one songbook — the family's own songs, the bundled hymnal, and the web,
 * behind a single search box. Replaces the old Hymns / Songs split.
 */
export default function SongbookScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const serverUrl = useStore((s) => s.settings.serverUrl);
  const songbook = useSongbook();
  const params = useLocalSearchParams<{ q?: string }>();

  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [scope, setScope] = useState<Scope>('all');
  const [lang, setLang] = useState<Lang>('all');
  const [base, setBase] = useState<Hymn[]>(() => allSongs(songbook));
  const [semantic, setSemantic] = useState(false);

  const mine = useMemo(() => mySongs(songbook), [songbook]);
  const favs = useMemo(() => favoriteSongs(songbook), [songbook]);
  const hasTamil = useMemo(() => allSongs(songbook).some((h) => h.language === 'ta'), [songbook]);

  // Meaning-based search (online, Tamil+English) with an offline keyword
  // fallback. Debounced so we don't fire a request on every keystroke.
  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      searchSongbook(query, { serverUrl, songbook }).then((r) => {
        if (!active) return;
        setBase(r.results);
        setSemantic(r.source === 'semantic');
      });
    }, query.trim().length >= 2 ? 300 : 0);
    return () => { active = false; clearTimeout(t); };
  }, [query, serverUrl, songbook]);

  const results = useMemo(() => {
    let list = base;
    if (scope === 'mine') list = list.filter((h) => isMine(h.id));
    if (scope === 'fav') {
      const favIds = new Set(favs.map((f) => f.id));
      list = list.filter((h) => favIds.has(h.id));
    }
    if (lang !== 'all') list = list.filter((h) => (h.language ?? 'en') === lang);
    return list;
  }, [base, scope, lang, favs]);

  const favIds = useMemo(() => new Set(favs.map((f) => f.id)), [favs]);
  const q = query.trim();

  const renderItem = ({ item: h }: { item: Hymn }) => (
    <Pressable
      onPress={() => router.push(`/songbook/${h.id}`)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.sm,
      })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="musical-notes-outline" size={20} color={isMine(h.id) ? colors.primary : colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }} numberOfLines={1}>{h.title}</Text>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }} numberOfLines={1}>
          {h.author ?? 'Traditional'}
          {h.language === 'ta' ? ' · தமிழ்' : ''}
          {hymnHasChords(h) ? ' · chords' : ''}
          {isMine(h.id) ? ' · mine' : ''}
        </Text>
      </View>
      {favIds.has(h.id) ? <Ionicons name="star" size={15} color={colors.warning} /> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Header
          title="Songbook"
          subtitle={`${allSongs(songbook).length} songs${mine.length ? ` · ${mine.length} yours` : ''}`}
          back
          right={
            <Pressable
              onPress={() => router.push('/songbook/new')}
              hitSlop={12}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primarySoft }}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.sm }}>Add a song</Text>
            </Pressable>
          }
        />
        <EmberTip topic="hymns" />
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search — title, author, or a line"
            placeholderTextColor={colors.textFaint}
            style={{ flex: 1, color: colors.text, fontSize: font.sizes.md }}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </Card>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {([['all', 'All'], ['mine', `Mine${mine.length ? ` (${mine.length})` : ''}`], ['fav', `★${favs.length ? ` ${favs.length}` : ''}`]] as const).map(([k, label]) => (
            <Pill key={k} label={label} active={scope === k} onPress={() => setScope(k)} />
          ))}
          {hasTamil ? (
            <>
              <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 2 }} />
              {([['all', 'Any'], ['en', 'English'], ['ta', 'தமிழ்']] as const).map(([k, label]) => (
                <Pill key={k} label={label} active={lang === k} onPress={() => setLang(k)} />
              ))}
            </>
          ) : null}
        </View>
        {semantic && q.length >= 2 ? (
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>✨ Sorted by meaning, not just words.</Text>
        ) : null}
      </View>

      <FlatList
        data={results}
        keyExtractor={(h) => h.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        ListEmptyComponent={
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }}>
            {scope === 'mine'
              ? 'No songs of your own yet — add the ones your family sings.'
              : scope === 'fav'
                ? 'No favourites yet — star the songs you come back to.'
                : q.length >= 2
                  ? 'Not in your songbook — try the web below.'
                  : 'Nothing here.'}
          </Text>
        }
        ListFooterComponent={<WebTier query={q} serverUrl={serverUrl} />}
      />
    </SafeAreaView>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: active ? colors.primary : colors.surfaceAlt }}
    >
      <Text style={{ color: active ? colors.onPrimary : colors.textMuted, fontWeight: '700', fontSize: font.sizes.sm }}>{label}</Text>
    </Pressable>
  );
}

/**
 * The web tier, inline. Discovery for songs we don't have — metadata + links
 * only (lyrics/chords stay on the publisher's page), plus a one-tap route into
 * "Add a song" so anything worth keeping lands in the songbook properly.
 */
function WebTier({ query, serverUrl }: { query: string; serverUrl: string | null }) {
  const { colors } = useTheme();
  const router = useRouter();
  const songbook = useSongbook();
  const [hits, setHits] = useState<SongHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastQuery = useRef<string>('');

  useEffect(() => {
    // A new query invalidates the previous web results.
    if (query !== lastQuery.current) { setHits(null); setError(null); }
  }, [query]);

  if (query.length < 2) return null;

  const run = async () => {
    lastQuery.current = query;
    setLoading(true);
    setError(null);
    try {
      setHits(await searchSongs(serverUrl, query));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  if (hits === null && !loading && !error) {
    return (
      <Pressable
        onPress={run}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt }}
      >
        <Ionicons name="globe-outline" size={16} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.sm }}>Search the web for “{query}”</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '800' }}>FROM THE WEB</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? (
        <Text style={{ color: colors.warning, fontSize: font.sizes.sm }}>
          {error.includes('not configured') ? 'Web search needs the Genius token set on your server (see setup).' : error}
        </Text>
      ) : null}
      {hits?.length === 0 ? (
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>No songs found. Try the title with the artist.</Text>
      ) : null}
      {(hits ?? []).map((s) => {
        const have = matchSongByTitle(s.title, songbook);
        return (
          <Card key={s.id} style={{ flexDirection: 'row', gap: spacing.md }}>
            {s.thumbnail ? (
              <Image source={{ uri: s.thumbnail }} style={{ width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }} />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="musical-note" size={20} color={colors.textFaint} />
              </View>
            )}
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }} numberOfLines={2}>{s.title}</Text>
              <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }} numberOfLines={1}>{s.artist}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 }}>
                {have ? (
                  <WebChip icon="library-outline" label="In your songbook" onPress={() => router.push(`/songbook/${have.id}`)} />
                ) : (
                  <WebChip
                    icon="add-circle-outline"
                    label="Add to songbook"
                    onPress={() => router.push(`/songbook/new?title=${encodeURIComponent(s.title)}&author=${encodeURIComponent(s.artist ?? '')}`)}
                  />
                )}
                <WebChip icon="document-text-outline" label="Lyrics" onPress={() => Linking.openURL(s.url)} />
                <WebChip icon="musical-notes-outline" label="Chords" onPress={() => Linking.openURL(songLinks.chords(s.title, s.artist))} />
                <WebChip icon="play-circle-outline" label="Listen" onPress={() => Linking.openURL(songLinks.listen(s.title, s.artist))} />
              </View>
            </View>
          </Card>
        );
      })}
      <Text style={{ color: colors.textFaint, fontSize: 10, textAlign: 'center' }}>
        Modern lyrics are copyrighted, so they open on the publisher’s page — never copied in.
      </Text>
    </View>
  );
}

function WebChip({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
      <Ionicons name={icon} size={13} color={colors.primary} />
      <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
