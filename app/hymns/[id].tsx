import React, { useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, SectionTitle, EmptyState } from '@/components/ui';
import { VersePeek } from '@/components/VersePeek';
import { useTheme, spacing, font, radius } from '@/theme';
import { getHymn, hymnHasChords, type HymnStanza } from '@/data/hymns';
import { parseChordLine, transposeKey } from '@/utils/chords';

export default function HymnScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const hymn = getHymn(typeof params.id === 'string' ? params.id : undefined);
  const [steps, setSteps] = useState(0);
  const [peek, setPeek] = useState<string | null>(null);

  if (!hymn) {
    return (
      <Screen>
        <Header title="Hymn" back />
        <EmptyState emoji="🎵" title="Hymn not found" />
      </Screen>
    );
  }

  const currentKey = transposeKey(hymn.key, steps);
  const hasChords = hymnHasChords(hymn);

  return (
    <Screen>
      <Header title={hymn.title} subtitle={`${hymn.author ?? ''}${hymn.year ? ` · ${hymn.year}` : ''}`} back />

      {/* Key + transpose (only when the hymn has chords) */}
      {hasChords ? (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <SectionTitle style={{ marginBottom: 2 }}>Key</SectionTitle>
          <Text style={{ color: colors.text, fontSize: font.sizes.xl, fontWeight: '800' }}>
            {currentKey}{steps !== 0 ? <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm }}> ({steps > 0 ? '+' : ''}{steps})</Text> : null}
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

      {/* Lyrics + chords */}
      {hymn.stanzas.map((st, i) => (
        <Stanza key={i} stanza={st} steps={steps} />
      ))}

      {/* Scripture behind the hymn */}
      {hymn.scriptureRefs.length > 0 ? (
        <View>
          <SectionTitle>The Scripture behind it</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {hymn.scriptureRefs.map((r) => <Chip key={r} label={r} onPress={() => setPeek(r)} />)}
          </View>
        </View>
      ) : null}

      {hymn.listenUrl ? (
        <Button title="Listen on YouTube" variant="secondary" icon={<Ionicons name="play-circle-outline" size={18} color={colors.text} />} onPress={() => Linking.openURL(hymn.listenUrl!)} />
      ) : null}

      <Text style={{ color: colors.textFaint, fontSize: 10, textAlign: 'center' }}>Public domain</Text>

      <VersePeek reference={peek} onClose={() => setPeek(null)} />
    </Screen>
  );
}

function Stanza({ stanza, steps }: { stanza: HymnStanza; steps: number }) {
  const { colors } = useTheme();
  const isChorus = stanza.kind !== 'verse';
  return (
    <Card style={{ gap: spacing.xs, borderLeftWidth: isChorus ? 3 : 0, borderLeftColor: colors.accent }}>
      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700', textTransform: 'uppercase' }}>
        {stanza.kind === 'verse' ? `Verse ${stanza.label ?? ''}`.trim() : stanza.kind === 'chorus' ? 'Chorus' : 'Refrain'}
      </Text>
      {stanza.lines.map((line, i) => (
        <ChordLine key={i} line={line} steps={steps} />
      ))}
    </Card>
  );
}

function ChordLine({ line, steps }: { line: string; steps: number }) {
  const { colors } = useTheme();
  const segments = parseChordLine(line, steps);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      {segments.map((s, i) => (
        <View key={i}>
          <Text style={{ color: colors.accent, fontWeight: '800', fontSize: font.sizes.xs, height: 16 }}>{s.chord ?? ' '}</Text>
          <Text style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24, fontFamily: font.serif }}>{s.text}</Text>
        </View>
      ))}
    </View>
  );
}

const stepBtn = (colors: any) => ({ width: 38, height: 38, borderRadius: 19, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.surfaceAlt });
