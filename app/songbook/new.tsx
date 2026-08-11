import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle } from '@/components/ui';
import { SongLyrics } from '@/components/SongLyrics';
import { useTheme, spacing, font } from '@/theme';
import { useStore, useSongbook } from '@/store/useStore';
import { getSong, isMine } from '@/data/songbook';
import { parseSongbook, songToText } from '@/utils/songbookParse';

const TEMPLATE = (title: string, author: string) =>
  `# ${title || 'Song title'}
@author: ${author || ''}
@key: G
@ref:

[verse]
Type the [G]first verse here
chords go in [C]square brackets

[chorus]
And the chorus here
`;

/**
 * Add a song to the family songbook — or write chords onto a bundled hymn.
 *
 * One text field in the songbook format (the same one `assets/songs/*.songbook.txt`
 * uses), with a live preview of exactly how it will be sung from. Typing a song
 * here is the only step needed: it is searchable, shareable, and attachable in
 * chat the moment it's saved.
 */
export default function SongEditorScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ edit?: string; title?: string; author?: string }>();
  const editId = typeof params.edit === 'string' ? params.edit : '';
  const songbook = useSongbook();
  const existing = useMemo(() => getSong(editId, songbook), [editId, songbook]);
  const editingBundled = !!existing && !isMine(existing.id);

  const saveSong = useStore((s) => s.saveSong);
  const setSongChords = useStore((s) => s.setSongChords);

  const [text, setText] = useState(() =>
    existing
      ? songToText(existing)
      : TEMPLATE(typeof params.title === 'string' ? params.title : '', typeof params.author === 'string' ? params.author : ''),
  );
  const [showHelp, setShowHelp] = useState(false);

  // The preview is the parse — what you see is exactly what gets stored.
  const parsed = useMemo(() => parseSongbook(text)[0], [text]);

  const save = () => {
    if (!parsed) {
      Alert.alert(
        'Nothing to save yet',
        'A song needs a “# Title” line and at least one line of lyrics.',
      );
      return;
    }
    if (editingBundled) {
      // A bundled hymn keeps its own identity; only the stanzas (your chords)
      // are stored as an overlay, so the original is never lost.
      setSongChords(existing!.id, parsed.stanzas);
      router.replace(`/songbook/${existing!.id}`);
      return;
    }
    const id = saveSong(parsed, existing?.id);
    router.replace(`/songbook/${id}`);
  };

  const resetOverlay = () => {
    if (!existing) return;
    setSongChords(existing.id, null);
    router.replace(`/songbook/${existing.id}`);
  };

  return (
    <Screen>
      <Header
        title={existing ? (editingBundled ? 'Your chords' : 'Edit song') : 'Add a song'}
        subtitle={editingBundled ? existing!.title : 'Lyrics and chords, kept on your device'}
        back
        right={
          <Pressable onPress={() => setShowHelp((v) => !v)} hitSlop={12} style={{ padding: 4 }}>
            <Ionicons name="help-circle-outline" size={22} color={colors.textFaint} />
          </Pressable>
        }
      />

      {showHelp ? (
        <Card style={{ gap: 6 }}>
          <SectionTitle>The format</SectionTitle>
          {[
            ['# Title', 'the first line — the song’s name'],
            ['@author: · @year: · @key:', 'who wrote it and the key the chords are in'],
            ['@ref: John 3:16; Psalm 23', 'the Scripture behind it (separated by ;)'],
            ['@listen: <url>', 'where to hear it'],
            ['[verse] · [chorus] · [pallavi]', 'starts a section (a blank line does too)'],
            ['A-[G]mazing grace', 'chords in square brackets, right where they fall'],
          ].map(([code, what]) => (
            <View key={code} style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Text style={{ color: colors.accent, fontSize: font.sizes.xs, fontWeight: '800', flex: 1.1 }}>{code}</Text>
              <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs, flex: 1.4 }}>{what}</Text>
            </View>
          ))}
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: 4 }}>
            Tamil is detected automatically — just type or paste it.
          </Text>
        </Card>
      ) : null}

      {editingBundled ? (
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
          This is a bundled hymn, so your edits are saved as your own chord sheet for it. The original
          is always one tap away.
        </Text>
      ) : null}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          autoCapitalize="sentences"
          autoCorrect={false}
          placeholder="# Song title…"
          placeholderTextColor={colors.textFaint}
          style={{
            color: colors.text,
            fontSize: font.sizes.sm,
            lineHeight: 22,
            minHeight: 260,
            padding: spacing.md,
            fontFamily: font.mono,
          }}
        />
      </Card>

      {parsed ? (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle>Preview</SectionTitle>
          <Card style={{ gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.lg }}>{parsed.title}</Text>
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
              {[parsed.author, parsed.year, `key of ${parsed.key}`, parsed.language === 'ta' ? 'தமிழ்' : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {parsed.scriptureRefs.length ? (
              <Text style={{ color: colors.accent, fontSize: font.sizes.xs, fontWeight: '700', marginTop: 2 }}>
                {parsed.scriptureRefs.join(' · ')}
              </Text>
            ) : null}
          </Card>
          <SongLyrics stanzas={parsed.stanzas} tamil={parsed.language === 'ta'} />
        </View>
      ) : (
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm, textAlign: 'center' }}>
          Start with a “# Title” line, then the lyrics.
        </Text>
      )}

      <Button
        title={editingBundled ? 'Save my chords' : existing ? 'Save changes' : 'Add to my songbook'}
        icon={<Ionicons name="checkmark" size={18} color={colors.onPrimary} />}
        disabled={!parsed}
        onPress={save}
      />

      {editingBundled && songbook.songChords?.[existing!.id] ? (
        <Button title="Back to the original" variant="ghost" onPress={resetOverlay} />
      ) : null}

      <Text style={{ color: colors.textFaint, fontSize: 10, textAlign: 'center', lineHeight: 15 }}>
        Songs you add stay on your device and in your own backup — for your family’s worship, not for
        publishing.
      </Text>
    </Screen>
  );
}
