import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, SectionTitle, EmptyState } from '@/components/ui';
import { RefText } from '@/components/RefText';
import { VerseActionSheet } from '@/components/VerseActionSheet';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore } from '@/store/useStore';
import { fetchSermon } from '@/data/aiClient';
import { parseReference, formatReference } from '@/data/books';
import { hydrateReference } from '@/data/localSearch';
import { HelpButton, EmberTip } from '@/components/EmberGuide';

export default function SermonScreen() {
  const { colors } = useTheme();
  const serverUrl = useStore((s) => s.settings.serverUrl);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [refs, setRefs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ reference: string; text: string } | null>(null);

  const trimmed = transcript.trim();
  const isUrl = /^https?:\/\//i.test(trimmed);

  const run = async () => {
    if (!isUrl && trimmed.length < 40) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const r = await fetchSermon(serverUrl, isUrl ? { url: trimmed } : { transcript });
      if (r.error && !r.summary) { setError(r.error); return; }
      setSummary(r.summary);
      // Validate references against the canonical book table (drop hallucinated/bad ones).
      const valid = Array.from(new Set(r.references.map((x) => { const p = parseReference(x); return p ? formatReference(p) : null; }).filter((x): x is string => !!x)));
      setRefs(valid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not summarize.');
    } finally {
      setLoading(false);
    }
  };

  const openRef = (reference: string) => {
    const hit = hydrateReference(reference);
    setSelected({ reference, text: hit?.text ?? '' });
  };

  return (
    <Screen>
      <Header title="Sermon notes" subtitle="Summary + every verse it cites" back right={<HelpButton topic="sermon" />} />

      {summary === null ? (
        <>
          <EmberTip topic="sermon" />
          <Card style={{ gap: spacing.sm }}>
            <SectionTitle>Paste a link or the transcript</SectionTitle>
            <TextInput
              value={transcript}
              onChangeText={setTranscript}
              placeholder="A YouTube or article link, or paste the sermon transcript / your notes…"
              placeholderTextColor={colors.textFaint}
              multiline
              textAlignVertical="top"
              autoCapitalize={isUrl ? 'none' : 'sentences'}
              style={{ color: colors.text, fontSize: font.sizes.md, minHeight: isUrl ? 60 : 180, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}
            />
            {isUrl ? (
              <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
                🔗 Link detected. Articles work best; YouTube is best-effort (needs captions). If it can’t read the video, paste the transcript instead.
              </Text>
            ) : null}
          </Card>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
            The AI writes an original summary and pulls out the Scripture references — it never copies the message text.
          </Text>
          <Button title={isUrl ? 'Read link & summarize' : 'Summarize & find verses'} icon={<Ionicons name="sparkles" size={18} color={colors.onPrimary} />} loading={loading} disabled={(!isUrl && trimmed.length < 40) || loading} onPress={run} />
          {error ? <Text style={{ color: colors.warning, fontSize: font.sizes.sm }}>{error}</Text> : null}
        </>
      ) : (
        <>
          <Card style={{ gap: spacing.sm }}>
            <SectionTitle>Summary</SectionTitle>
            <RefText text={summary || 'No summary returned.'} />
            <Text style={{ color: colors.textFaint, fontSize: 10, marginTop: 4 }}>AI summary — weigh it against the message and the Word.</Text>
          </Card>

          {refs.length > 0 ? (
            <View>
              <SectionTitle>Verses referenced ({refs.length})</SectionTitle>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {refs.map((r) => <Chip key={r} label={r} onPress={() => openRef(r)} />)}
              </View>
              <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: spacing.sm }}>Tap a verse to read, memorize, or study it.</Text>
            </View>
          ) : (
            <EmptyState emoji="📖" title="No verses detected" subtitle="The message may not have cited specific references." />
          )}

          <Button title="New sermon" variant="secondary" onPress={() => { setSummary(null); setRefs([]); setTranscript(''); }} />
        </>
      )}

      <VerseActionSheet visible={!!selected} onClose={() => setSelected(null)} reference={selected?.reference ?? ''} text={selected?.text ?? ''} translation="kjv" />
    </Screen>
  );
}
