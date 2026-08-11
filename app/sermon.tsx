import React, { useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, SectionTitle, EmptyState } from '@/components/ui';
import { RefText } from '@/components/RefText';
import { VerseActionSheet } from '@/components/VerseActionSheet';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore } from '@/store/useStore';
import { fetchSermon } from '@/data/aiClient';
import { hydrateReference } from '@/data/localSearch';
import { isYoutubeUrl, fetchYoutubeTranscript } from '@/data/youtube';
import { teachingToBlocks, teachingTitle, teachingIsEmpty, type Teaching } from '@/utils/teaching';
import { HelpButton, EmberTip } from '@/components/EmberGuide';

/**
 * Teaching notes from a sermon — paste a link or the transcript and get the
 * message's outline, the truths worth keeping, every verse it cited, and how to
 * live it. It doesn't evaporate: save it to Notes, memorize its verses, or send
 * it to your partner.
 */
export default function SermonScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const serverUrl = useStore((s) => s.settings.serverUrl);
  const createDoc = useStore((s) => s.createDoc);
  const shareNote = useStore((s) => s.shareNote);
  const completeWalkMovement = useStore((s) => s.completeWalkMovement);
  const circleCodes = useStore((s) => Object.keys(s.circles));

  const [transcript, setTranscript] = useState('');
  const [teaching, setTeaching] = useState<Teaching | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ reference: string; text: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const trimmed = transcript.trim();
  const isUrl = /^https?:\/\//i.test(trimmed);

  const run = async () => {
    if (!isUrl && trimmed.length < 40) return;
    setLoading(true);
    setError(null);
    setTeaching(null);
    setSaved(false);
    try {
      // For a YouTube link, try fetching captions ON THE DEVICE first (residential
      // IP → far more reliable than the Worker's datacenter IP). Fall back to the
      // server's best-effort URL read, then to paste.
      let input: { transcript?: string; url?: string } = isUrl ? { url: trimmed } : { transcript };
      if (isUrl && isYoutubeUrl(trimmed)) {
        const captions = await fetchYoutubeTranscript(trimmed).catch(() => '');
        if (captions.trim().length > 40) input = { transcript: captions };
      }
      const r = await fetchSermon(serverUrl, input);
      if (r.error && teachingIsEmpty(r.teaching)) { setError(r.error); return; }
      setSourceUrl(isUrl ? trimmed : null);
      setTeaching(r.teaching);
      completeWalkMovement('teaching');
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

  const saveToNotes = () => {
    if (!teaching) return;
    const id = createDoc('sermon', {
      title: teachingTitle(teaching),
      blocks: teachingToBlocks(teaching, { source: sourceUrl ?? undefined }),
      tags: ['teaching'],
    });
    setSaved(true);
    router.push(`/notes/${id}`);
  };

  const shareToPartner = () => {
    if (!teaching || circleCodes.length === 0) return;
    const text = [
      teachingTitle(teaching),
      teaching.summary,
      teaching.keyPoints.length ? teaching.keyPoints.map((k) => `• ${k}`).join('\n') : '',
      teaching.references.length ? teaching.references.join(' · ') : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    void shareNote(circleCodes[0], text, 'free');
    Alert.alert('Sent to your partner 💛', 'They’ll find it in your shared notes.');
  };

  const reset = () => { setTeaching(null); setTranscript(''); setSaved(false); setSourceUrl(null); };

  return (
    <Screen>
      <Header title="Teaching notes" subtitle="Outline · key points · every verse" back right={<HelpButton topic="sermon" />} />

      {teaching === null ? (
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
            A full-length message is read in sections, so nothing is cut off. The AI writes original
            notes and pulls out the Scripture — it never copies the message text.
          </Text>
          <Button
            title={isUrl ? 'Read link & take notes' : 'Take notes & find verses'}
            icon={<Ionicons name="sparkles" size={18} color={colors.onPrimary} />}
            loading={loading}
            disabled={(!isUrl && trimmed.length < 40) || loading}
            onPress={run}
          />
          {loading ? (
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, textAlign: 'center' }}>
              Listening through the whole message…
            </Text>
          ) : null}
          {error ? <Text style={{ color: colors.warning, fontSize: font.sizes.sm }}>{error}</Text> : null}
        </>
      ) : (
        <>
          {teaching.title ? (
            <Text style={{ color: colors.text, fontSize: font.sizes.xl, fontWeight: '800', lineHeight: 32 }}>
              {teaching.title}
            </Text>
          ) : null}

          {teaching.summary ? (
            <Card style={{ gap: spacing.sm }}>
              <SectionTitle>In short</SectionTitle>
              <RefText text={teaching.summary} />
            </Card>
          ) : null}

          {teaching.outline.length > 0 ? (
            <View>
              <SectionTitle>How it went</SectionTitle>
              <View style={{ gap: spacing.sm }}>
                {teaching.outline.map((sec, i) => (
                  <Card key={i} style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 11 }}>{i + 1}</Text>
                      </View>
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md, flex: 1 }}>{sec.heading}</Text>
                    </View>
                    {sec.points.map((p, j) => (
                      <View key={j} style={{ flexDirection: 'row', gap: spacing.sm, paddingLeft: 30 }}>
                        <Text style={{ color: colors.textFaint }}>•</Text>
                        <RefText text={p} style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 21, flex: 1 }} />
                      </View>
                    ))}
                  </Card>
                ))}
              </View>
            </View>
          ) : null}

          {teaching.keyPoints.length > 0 ? (
            <View>
              <SectionTitle>Worth remembering</SectionTitle>
              <Card style={{ gap: spacing.sm }}>
                {teaching.keyPoints.map((k, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Ionicons name="ellipse" size={7} color={colors.accent} style={{ marginTop: 7 }} />
                    <RefText text={k} style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 23, flex: 1 }} />
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          {teaching.references.length > 0 ? (
            <View>
              <SectionTitle>Verses referenced ({teaching.references.length})</SectionTitle>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {teaching.references.map((r) => <Chip key={r} label={r} onPress={() => openRef(r)} />)}
              </View>
              <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: spacing.sm }}>
                Tap any verse to read it, memorize it, or study it.
              </Text>
            </View>
          ) : (
            <EmptyState emoji="📖" title="No verses detected" subtitle="The message may not have cited specific references." />
          )}

          {teaching.application ? (
            <Card style={{ gap: 6, borderLeftWidth: 3, borderLeftColor: colors.success }}>
              <SectionTitle>Living it out</SectionTitle>
              <RefText text={teaching.application} style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24, fontStyle: 'italic' }} />
            </Card>
          ) : null}

          <Text style={{ color: colors.textFaint, fontSize: 10 }}>
            AI-written notes — weigh them against the message and the Word.
          </Text>

          {/* Where it goes next — the notes don't evaporate. */}
          <View style={{ gap: spacing.sm }}>
            <Button
              title={saved ? 'Saved to Notes ✓' : 'Save to Notes'}
              icon={<Ionicons name="bookmark-outline" size={18} color={colors.onPrimary} />}
              disabled={saved}
              onPress={saveToNotes}
            />
            {circleCodes.length > 0 ? (
              <Button
                title="Share with your partner"
                variant="secondary"
                icon={<Ionicons name="people-outline" size={18} color={colors.text} />}
                onPress={shareToPartner}
              />
            ) : null}
            <Button title="New teaching" variant="ghost" onPress={reset} />
          </View>
        </>
      )}

      <VerseActionSheet visible={!!selected} onClose={() => setSelected(null)} reference={selected?.reference ?? ''} text={selected?.text ?? ''} translation="kjv" />
    </Screen>
  );
}
