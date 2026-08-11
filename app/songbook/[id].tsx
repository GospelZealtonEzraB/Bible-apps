import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, SectionTitle, EmptyState } from '@/components/ui';
import { VersePeek } from '@/components/VersePeek';
import { useTheme, spacing, font, radius } from '@/theme';
import { getSong, playLinks, chordChartUrl, isMine, hymnHasChords } from '@/data/songbook';
import { SongLyrics } from '@/components/SongLyrics';
import { transposeKey } from '@/utils/chords';
import { useStore, useSongbook } from '@/store/useStore';
import { fetchVersesForSong } from '@/data/aiClient';
import { validateReferences } from '@/data/books';
import { dayKey } from '@/utils/date';

export default function SongScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const songbook = useSongbook();
  const song = useMemo(() => getSong(id, songbook), [id, songbook]);

  const serverUrl = useStore((s) => s.settings.serverUrl);
  const toggleFavoriteSong = useStore((s) => s.toggleFavoriteSong);
  const deleteSong = useStore((s) => s.deleteSong);
  const completeWalkMovement = useStore((s) => s.completeWalkMovement);
  const shareDailyItem = useStore((s) => s.shareDailyItem);
  const circleCodes = useStore((s) => Object.keys(s.circles));

  const [steps, setSteps] = useState(0);
  const [peek, setPeek] = useState<string | null>(null);
  const [aiRefs, setAiRefs] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [sung, setSung] = useState(false);

  const isFavorite = (songbook.favoriteSongs ?? []).includes(id);

  const findScripture = async () => {
    if (!song) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const raw = await fetchVersesForSong(serverUrl, song.title, song.author);
      setAiRefs(validateReferences(raw));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Could not load.');
    } finally {
      setAiLoading(false);
    }
  };

  /**
   * "Sing this today" — credits the worship movement of today's walk and, when
   * they have a partner, puts the song in today's shared window so the other
   * can sing it too.
   */
  const singToday = () => {
    if (!song) return;
    completeWalkMovement('worship');
    setSung(true);
    for (const code of circleCodes) void shareDailyItem(code, dayKey(), 'song', song.id);
  };

  const confirmDelete = () => {
    if (!song) return;
    Alert.alert('Remove song', `Remove “${song.title}” from your songbook?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { deleteSong(song.id); router.back(); } },
    ]);
  };

  if (!song) {
    return (
      <Screen>
        <Header title="Song" back />
        <EmptyState emoji="🎵" title="Song not found" subtitle="It may have been removed from your songbook." />
      </Screen>
    );
  }

  const currentKey = transposeKey(song.key, steps);
  const hasChords = hymnHasChords(song);
  const mine = isMine(song.id);
  const hasOverlay = !!songbook.songChords?.[song.id];

  return (
    <Screen>
      <Header
        title={song.title}
        subtitle={`${song.author ?? ''}${song.year ? ` · ${song.year}` : ''}`}
        back
        right={
          <Pressable onPress={() => toggleFavoriteSong(song.id)} hitSlop={12} style={{ padding: 4 }}>
            <Ionicons name={isFavorite ? 'star' : 'star-outline'} size={22} color={isFavorite ? colors.warning : colors.textFaint} />
          </Pressable>
        }
      />

      {/* Listen — deep links out; we don't host audio. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {playLinks(song).map((l) => (
          <Pressable
            key={l.key}
            onPress={() => Linking.openURL(l.url).catch(() => {})}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}
          >
            <Ionicons name="play-circle-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.sizes.sm }}>{l.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Sing it today — the worship movement of the daily walk. */}
      <Button
        title={sung ? 'Sung today ✓' : 'Sing this today'}
        variant={sung ? 'secondary' : 'primary'}
        disabled={sung}
        icon={<Ionicons name="musical-notes" size={18} color={sung ? colors.text : colors.onPrimary} />}
        onPress={singToday}
      />
      {sung && circleCodes.length > 0 ? (
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, textAlign: 'center', marginTop: -spacing.sm }}>
          Added to today’s walk, and shared to your devotion window.
        </Text>
      ) : null}

      {/* Key + transpose (only when there are chords to transpose) */}
      {hasChords ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <SectionTitle style={{ marginBottom: 2 }}>Key</SectionTitle>
            <Text style={{ color: colors.text, fontSize: font.sizes.xl, fontWeight: '800' }}>
              {currentKey}
              {steps !== 0 ? <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm }}> ({steps > 0 ? '+' : ''}{steps})</Text> : null}
            </Text>
          </View>
          <Pressable onPress={() => setSteps((s) => s - 1)} hitSlop={8} style={stepBtn(colors)}>
            <Ionicons name="remove" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => setSteps(0)} hitSlop={8} style={{ paddingHorizontal: 4 }}>
            <Ionicons name="refresh" size={18} color={colors.textFaint} />
          </Pressable>
          <Pressable onPress={() => setSteps((s) => s + 1)} hitSlop={8} style={stepBtn(colors)}>
            <Ionicons name="add" size={22} color={colors.text} />
          </Pressable>
        </Card>
      ) : null}

      {/* Lyrics + chords — or, for a link-only song, a deep link out */}
      {song.stanzas.length > 0 ? (
        <SongLyrics stanzas={song.stanzas} steps={steps} tamil={song.language === 'ta'} />
      ) : (
        <Card style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
            Lyrics for this song aren’t in your songbook yet. Open them on the web — or type them in so
            they’re yours offline.
          </Text>
          <Button
            title="Lyrics on the web"
            variant="secondary"
            icon={<Ionicons name="open-outline" size={16} color={colors.text} />}
            onPress={() => Linking.openURL(song.lyricsUrl || song.listenUrl || `https://www.google.com/search?q=${encodeURIComponent(song.title + ' lyrics')}`)}
          />
        </Card>
      )}

      {/* Chords: write your own onto a lyrics-only hymn, or edit your song. */}
      <Button
        title={mine ? 'Edit this song' : hasChords ? 'Edit the chords' : 'Add chords'}
        variant="secondary"
        icon={<Ionicons name="create-outline" size={16} color={colors.text} />}
        onPress={() => router.push(`/songbook/new?edit=${encodeURIComponent(song.id)}`)}
      />
      {!hasChords && !mine ? (
        <Pressable onPress={() => Linking.openURL(chordChartUrl(song))}>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, textAlign: 'center' }}>
            Find a chord chart on the web →
          </Text>
        </Pressable>
      ) : null}
      {hasOverlay ? (
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, textAlign: 'center' }}>
          Showing your chords for this hymn.
        </Text>
      ) : null}

      {/* Scripture behind the song */}
      {song.scriptureRefs.length > 0 ? (
        <View>
          <SectionTitle>The Scripture behind it</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {song.scriptureRefs.map((r) => <Chip key={r} label={r} onPress={() => setPeek(r)} />)}
          </View>
        </View>
      ) : (
        <View>
          <SectionTitle>The Scripture behind it</SectionTitle>
          {aiRefs === null ? (
            <Button
              title={aiLoading ? 'Finding…' : 'Find the Scripture (AI)'}
              variant="secondary"
              loading={aiLoading}
              icon={<Ionicons name="sparkles-outline" size={16} color={colors.text} />}
              onPress={findScripture}
            />
          ) : aiRefs.length > 0 ? (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {aiRefs.map((r) => <Chip key={r} label={r} onPress={() => setPeek(r)} />)}
              </View>
              <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '700' }}>
                AI-suggested — tap to read and weigh against the song.
              </Text>
            </View>
          ) : (
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm }}>No clear references found.</Text>
          )}
          {aiError ? (
            <Text style={{ color: colors.warning, fontSize: font.sizes.xs, marginTop: 4 }}>
              {aiError.includes('Server URL') || aiError.includes('not configured') ? 'AI needs your Server URL in Settings.' : aiError}
            </Text>
          ) : null}
        </View>
      )}

      {mine ? (
        <Button title="Remove from my songbook" variant="ghost" onPress={confirmDelete} />
      ) : null}

      <Text style={{ color: colors.textFaint, fontSize: 10, textAlign: 'center' }}>
        {song.source === 'pd' ? 'Public domain' : song.source === 'personal' ? 'Your songbook — kept private to your family' : ''}
      </Text>

      <VersePeek reference={peek} onClose={() => setPeek(null)} />
    </Screen>
  );
}

const stepBtn = (colors: any) => ({ width: 38, height: 38, borderRadius: 19, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.surfaceAlt });
