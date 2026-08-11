import React from 'react';
import { View, Text } from 'react-native';

import { Card } from '@/components/ui';
import { useTheme, spacing, font } from '@/theme';
import { parseChordLine } from '@/utils/chords';
import type { HymnStanza } from '@/data/songbook';

/**
 * Lyrics with inline chords, transposed. Shared by the song screen and the
 * song editor's live preview so what you type is exactly what you'll sing from.
 */
export function SongLyrics({
  stanzas,
  steps = 0,
  tamil = false,
}: {
  stanzas: HymnStanza[];
  steps?: number;
  tamil?: boolean;
}) {
  return (
    <>
      {stanzas.map((st, i) => (
        <Stanza key={i} stanza={st} steps={steps} tamil={tamil} />
      ))}
    </>
  );
}

function Stanza({ stanza, steps, tamil }: { stanza: HymnStanza; steps: number; tamil: boolean }) {
  const { colors } = useTheme();
  const isChorus = stanza.kind !== 'verse';
  return (
    <Card style={{ gap: spacing.xs, borderLeftWidth: isChorus ? 3 : 0, borderLeftColor: colors.accent }}>
      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700', textTransform: 'uppercase' }}>
        {stanza.kind === 'verse' ? `Verse ${stanza.label ?? ''}`.trim() : stanza.kind === 'chorus' ? 'Chorus' : 'Refrain'}
      </Text>
      {stanza.lines.map((line, i) => (
        <ChordLine key={i} line={line} steps={steps} tamil={tamil} />
      ))}
    </Card>
  );
}

function ChordLine({ line, steps, tamil }: { line: string; steps: number; tamil: boolean }) {
  const { colors } = useTheme();
  const segments = parseChordLine(line, steps);
  // Tamil has no glyphs in the Georgia serif stack — render it in the system font.
  const lyricFont = tamil ? undefined : font.serif;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      {segments.map((s, i) => (
        <View key={i}>
          <Text style={{ color: colors.accent, fontWeight: '800', fontSize: font.sizes.xs, height: 16 }}>{s.chord ?? ' '}</Text>
          <Text style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24, fontFamily: lyricFont }}>{s.text}</Text>
        </View>
      ))}
    </View>
  );
}
