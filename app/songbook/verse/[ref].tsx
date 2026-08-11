import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, SectionTitle, EmptyState } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore, useSongbook } from '@/store/useStore';
import { songsForRef, matchSongByTitle, type HymnRefMatch } from '@/data/songbook';
import { fetchSongsForVerse, type SuggestedSong } from '@/data/aiClient';

const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
const genius = (q: string) => `https://genius.com/search?q=${encodeURIComponent(q)}`;

/**
 * "Songs from this verse" — the bidirectional flip of the songbook. Two tiers:
 * (1) GROUNDED: songs we have (bundled hymns and the family's own) whose
 *     scriptureRefs actually match this verse — real, in-app, tappable.
 * (2) AI: famous (public-domain-first) hymns/songs the verse inspired, each
 *     flagged "verify" and linked in-app if we have it, else out to a search.
 */
export default function SongsForVerseScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ ref: string }>();
  const reference = typeof params.ref === 'string' ? decodeURIComponent(params.ref) : '';
  const serverUrl = useStore((s) => s.settings.serverUrl);
  const songbook = useSongbook();

  // Grounded tier: every song we actually have — bundled or your own.
  const grounded: HymnRefMatch[] = reference ? songsForRef(reference, songbook) : [];

  const [ai, setAi] = useState<SuggestedSong[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setAi(null);
    setError(null);
    setLoading(true);
    fetchSongsForVerse(serverUrl, reference)
      .then((songs) => active && setAi(songs))
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Could not load suggestions.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reference, serverUrl]);

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  // Don't repeat, in the AI list, a hymn already shown in the grounded section.
  const groundedIds = new Set(grounded.map((g) => g.hymn.id));

  return (
    <Screen>
      <Header title="Songs from this verse" subtitle={reference} back />

      {grounded.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle>In your songbook</SectionTitle>
          {grounded.map(({ hymn, precision }) => (
            <Card key={hymn.id} onPress={() => router.push(`/songbook/${hymn.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="musical-notes" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{hymn.title}</Text>
                <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
                  {hymn.author ?? 'Public domain'}{hymn.year ? ` · ${hymn.year}` : ''}{precision === 'exact' ? ' · quotes this verse' : ' · from this chapter'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Card>
          ))}
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <SectionTitle>More songs {loading ? '' : '(AI)'}</SectionTitle>

        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm }}>Finding hymns & songs inspired by this verse…</Text>
          </View>
        ) : null}

        {error ? (
          <Text style={{ color: colors.warning, fontSize: font.sizes.sm }}>
            {error.includes('Server URL') || error.includes('not configured') ? 'AI suggestions need your Server URL in Settings.' : error}
          </Text>
        ) : null}

        {ai && ai.length > 0 ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="warning-outline" size={13} color={colors.warning} />
              <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '700' }}>AI-suggested — author & year are given so you can verify. Public-domain first.</Text>
            </View>
            {ai.map((song, i) => {
              const inApp = matchSongByTitle(song.title, songbook);
              const alreadyShown = inApp && groundedIds.has(inApp.id);
              if (alreadyShown) return null;
              return (
                <Card key={`${song.title}-${i}`} style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{song.title}</Text>
                        {song.pd ? (
                          <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
                            <Text style={{ color: colors.success, fontSize: 10, fontWeight: '800' }}>PUBLIC DOMAIN</Text>
                          </View>
                        ) : null}
                      </View>
                      {song.author || song.year ? (
                        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{[song.author, song.year].filter(Boolean).join(' · ')}</Text>
                      ) : null}
                    </View>
                  </View>
                  {song.why ? <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, fontStyle: 'italic' }}>{song.why}</Text> : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {inApp ? (
                      <LinkChip icon="open-outline" label="Open in songbook" primary onPress={() => router.push(`/songbook/${inApp.id}`)} />
                    ) : null}
                    <LinkChip icon="logo-youtube" label="Listen" onPress={() => open(yt(`${song.title} ${song.author ?? ''} hymn`))} />
                    <LinkChip icon="document-text-outline" label="Lyrics (web)" onPress={() => open(genius(`${song.title} ${song.author ?? ''}`))} />
                  </View>
                </Card>
              );
            })}
          </>
        ) : null}

        {ai && ai.length === 0 && !error ? (
          <EmptyState emoji="🎵" title="No song suggestions" subtitle="We couldn’t find well-known songs tied to this verse. Try a nearby verse." />
        ) : null}
      </View>

      <Text style={{ color: colors.textFaint, fontSize: 10, textAlign: 'center' }}>
        Lyrics are copyrighted for modern songs, so they open on the web — never copied into the app.
      </Text>
    </Screen>
  );
}

function LinkChip({ icon, label, onPress, primary }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; primary?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: primary ? colors.primarySoft : colors.surfaceAlt }}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
