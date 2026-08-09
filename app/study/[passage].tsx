import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, Alert, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, SectionTitle, EmptyState, SpeechBubble } from '@/components/ui';
import { Ember } from '@/components/Ember';
import { pickEmberLine } from '@/data/emberLines';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStudySession, useApplication, useStore } from '@/store/useStore';
import { fetchStudyBrief } from '@/data/studyClient';
import { getChapterVerses, normalizeKey, isLatinTranslation, type ChapterVerse } from '@/data/bibleApi';
import { parseScope, segmentReference } from '@/data/scope';
import type { StudyBrief } from '@/types';

/** Max chapters rendered inline under "Read the passage" (a whole book is huge). */
const MAX_INLINE_CHAPTERS = 6;

export default function StudyBriefScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ passage: string }>();
  const passage = typeof params.passage === 'string' ? decodeURIComponent(params.passage) : '';
  const passageKey = normalizeKey(passage);

  const session = useStudySession(passageKey);
  const serverUrl = useStore((s) => s.settings.serverUrl);
  const translation = useStore((s) => s.settings.translation);
  const setStudySession = useStore((s) => s.setStudySession);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session || !passage) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetchStudyBrief(serverUrl, passage)
      .then((r) => {
        if (active) setStudySession({ passage, passageKey, brief: r.brief, fetchedAt: Date.now() });
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Could not generate the brief.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [passageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const brief = session?.brief;

  return (
    <Screen>
      <Header title={passage} subtitle="Study brief" back />

      {loading ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Ember mood="thinking" size={64} />
          <SpeechBubble>Setting the scene — reading what comes before, the people, and the place…</SpeechBubble>
        </Card>
      ) : null}

      {error && !brief ? (
        <EmptyState
          emoji="✨"
          title="Couldn’t generate the brief"
          subtitle={error}
          action={<Button title="Try again" onPress={() => { setError(null); setLoading(true); fetchStudyBrief(serverUrl, passage).then((r) => setStudySession({ passage, passageKey, brief: r.brief, fetchedAt: Date.now() })).catch((e) => setError(e instanceof Error ? e.message : 'Failed')).finally(() => setLoading(false)); }} />}
        />
      ) : null}

      {brief ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Ember mood="reading" size={60} />
          <SpeechBubble>{pickEmberLine('study', passage.length)}</SpeechBubble>
        </Card>
      ) : null}

      {brief ? <BriefBody brief={brief} passage={passage} translation={translation} serverUrl={serverUrl} onOpenRef={(r) => router.push(`/study/${encodeURIComponent(r)}`)} /> : null}

      {brief ? <ApplicationCard passageKey={passageKey} passage={passage} /> : null}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  if (!children) return null;
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <SectionTitle>{title}</SectionTitle>
      {typeof children === 'string' ? (
        <Text style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24 }}>{children}</Text>
      ) : (
        children
      )}
    </Card>
  );
}

function BriefBody({
  brief,
  passage,
  translation,
  serverUrl,
  onOpenRef,
}: {
  brief: StudyBrief;
  passage: string;
  translation: string;
  serverUrl: string | null;
  onOpenRef: (ref: string) => void;
}) {
  const { colors } = useTheme();
  const [sections, setSections] = useState<{ ref: string; verses: ChapterVerse[] }[] | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(0);

  const loadPassage = async () => {
    setLoadingText(true);
    setTextError(null);
    try {
      const scope = parseScope(passage);
      const segments = scope?.segments ?? [];
      if (segments.length === 0) throw new Error('Enter a verse, range, chapter, book, or list.');
      const shown = segments.slice(0, MAX_INLINE_CHAPTERS);
      setTruncated(Math.max(0, segments.length - shown.length));
      const out: { ref: string; verses: ChapterVerse[] }[] = [];
      for (const seg of shown) {
        const ref = segmentReference(seg);
        const r = await getChapterVerses(ref, translation, { serverUrl });
        out.push({ ref: r.reference, verses: r.verses });
      }
      setSections(out);
    } catch (e) {
      setTextError(e instanceof Error ? e.message : 'Could not load the passage.');
    } finally {
      setLoadingText(false);
    }
  };

  const multi = (sections?.length ?? 0) > 1;

  return (
    <View>
      {brief.summaryBefore ? <Section title="Before this passage">{brief.summaryBefore}</Section> : null}
      {brief.setting ? <Section title="The scene & setting">{brief.setting}</Section> : null}

      {brief.speakerAudience ? <Section title="Who's speaking to whom">{brief.speakerAudience}</Section> : null}

      {brief.characters.length > 0 ? (
        <Section title="Characters">
          <View style={{ gap: spacing.sm }}>
            {brief.characters.map((c, i) => (
              <View key={i}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>{c.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 22 }}>{c.insight}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {brief.location || brief.background ? (
        <Section title="Location & background">
          <View style={{ gap: spacing.sm }}>
            {brief.location ? <Text style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24 }}>{brief.location}</Text> : null}
            {brief.background ? <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 22 }}>{brief.background}</Text> : null}
          </View>
        </Section>
      ) : null}

      {brief.wordStudy.length > 0 ? (
        <Section title="Word study">
          <View style={{ gap: spacing.sm }}>
            {brief.wordStudy.map((w, i) => (
              <View key={i}>
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: font.sizes.md }}>
                  {w.term} <Text style={{ color: colors.textFaint, fontWeight: '400', fontSize: font.sizes.xs }}>({w.language})</Text>
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 22 }}>{w.insight}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {brief.discussionQuestions.length > 0 ? (
        <Section title="Discussion questions">
          <View style={{ gap: spacing.sm }}>
            {brief.discussionQuestions.map((q, i) => (
              <Text key={i} style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24 }}>
                {i + 1}. {q}
              </Text>
            ))}
          </View>
        </Section>
      ) : null}

      {brief.crossReferences.length > 0 ? (
        <Section title="Related passages">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {brief.crossReferences.map((r) => (
              <Chip key={r} label={r} onPress={() => onOpenRef(r)} />
            ))}
          </View>
        </Section>
      ) : null}

      {/* Read the actual passage (provider text) — any scope, chapter by chapter */}
      <Card style={{ marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionTitle style={{ marginBottom: 0 }}>Read the passage</SectionTitle>
          {!sections ? <Button title={loadingText ? '…' : 'Show verses'} variant="secondary" small loading={loadingText} onPress={loadPassage} /> : null}
        </View>
        {textError ? <Text style={{ color: colors.warning, fontSize: font.sizes.xs, marginTop: spacing.sm }}>{textError}</Text> : null}
        {sections ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.md }}>
            {sections.map((sec) => (
              <View key={sec.ref} style={{ gap: 6 }}>
                {multi ? <Text style={{ color: colors.primary, fontSize: font.sizes.sm, fontWeight: '800' }}>{sec.ref}</Text> : null}
                {sec.verses.map((v) => (
                  <Text key={v.verse} style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 26, fontFamily: isLatinTranslation(translation) ? font.serif : undefined }}>
                    <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{v.verse} </Text>
                    {v.text}
                  </Text>
                ))}
              </View>
            ))}
            {truncated > 0 ? (
              <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontStyle: 'italic' }}>
                +{truncated} more chapter{truncated === 1 ? '' : 's'} — open the reader to read the rest.
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>
    </View>
  );
}

function ApplicationCard({ passageKey, passage }: { passageKey: string; passage: string }) {
  const { colors } = useTheme();
  const application = useApplication(passageKey);
  const addApplication = useStore((s) => s.addApplication);
  const editApplication = useStore((s) => s.editApplication);
  const deleteApplication = useStore((s) => s.deleteApplication);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const inputStyle = { color: colors.text, fontSize: font.sizes.md, minHeight: 70, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md } as const;

  const confirmDelete = () =>
    Alert.alert('Delete this commitment?', 'You can always add a new one.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteApplication(passageKey) },
    ]);

  if (application && !editing) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SectionTitle style={{ marginBottom: 0, flex: 1 }}>Living it out</SectionTitle>
          <Pressable onPress={() => { setDraft(application.text); setEditing(true); }} hitSlop={8} style={{ paddingHorizontal: 4 }}>
            <Ionicons name="pencil" size={15} color={colors.textFaint} />
          </Pressable>
          <Pressable onPress={confirmDelete} hitSlop={8} style={{ paddingHorizontal: 4 }}>
            <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
          </Pressable>
        </View>
        <Text style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24, marginTop: spacing.sm }}>✅ {application.text}</Text>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: 4 }}>
          We’ll check back with you on this.
        </Text>
      </Card>
    );
  }

  if (application && editing) {
    return (
      <Card>
        <SectionTitle>Edit your commitment</SectionTitle>
        <TextInput value={draft} onChangeText={setDraft} placeholder="This week I will…" placeholderTextColor={colors.textFaint} multiline textAlignVertical="top" style={inputStyle} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => setEditing(false)} />
          <Button title="Save" small style={{ flex: 1 }} disabled={!draft.trim()} onPress={() => { editApplication(passageKey, draft); setEditing(false); }} />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>One thing I’ll live out</SectionTitle>
      <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginBottom: spacing.sm }}>
        Turn study into growth — name one way you’ll live this passage out this week.
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="This week I will…"
        placeholderTextColor={colors.textFaint}
        multiline
        textAlignVertical="top"
        style={inputStyle}
      />
      <View style={{ marginTop: spacing.md }}>
        <Button title="Save my commitment" onPress={() => text.trim() && addApplication(passageKey, passage, text)} disabled={!text.trim()} />
      </View>
    </Card>
  );
}
