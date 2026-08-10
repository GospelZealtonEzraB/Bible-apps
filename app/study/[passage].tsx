import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, Alert, Pressable, Linking, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle, EmptyState, SpeechBubble } from '@/components/ui';
import { RefText } from '@/components/RefText';
import { PeekableRef } from '@/components/PeekableRef';
import { Ember } from '@/components/Ember';
import { pickEmberLine } from '@/data/emberLines';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStudySession, useApplication, useStore } from '@/store/useStore';
import { fetchStudyBrief, fetchStudyContext, askStudy } from '@/data/studyClient';
import { getChapterVerses, normalizeKey, isLatinTranslation, type ChapterVerse } from '@/data/bibleApi';
import { validateReferences } from '@/data/books';
import { parseScope, segmentReference } from '@/data/scope';
import { markdownToBlocks } from '@/utils/blocks';
import type { StudyBrief, StudyContextItem } from '@/types';

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

      {brief ? <BriefBody brief={brief} passage={passage} translation={translation} serverUrl={serverUrl} /> : null}

      {brief ? <HistoryContext passage={passage} serverUrl={serverUrl} /> : null}

      {brief ? <AskPanel passage={passage} serverUrl={serverUrl} /> : null}

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
        <RefText text={children} style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24 }} />
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
}: {
  brief: StudyBrief;
  passage: string;
  translation: string;
  serverUrl: string | null;
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

  const facts: { label: string; value?: string }[] = [
    { label: 'Speaker', value: brief.speaker },
    { label: 'Audience', value: brief.audience },
    { label: 'Where', value: brief.where },
    { label: 'When', value: brief.when },
    { label: 'Occasion', value: brief.occasion },
    { label: 'Genre', value: brief.genre },
  ].filter((f) => f.value && f.value.trim());

  return (
    <View>
      {facts.length > 0 || brief.oneLine ? (
        <Card style={{ marginBottom: spacing.sm, gap: spacing.sm }}>
          <SectionTitle style={{ marginBottom: 0 }}>At a glance</SectionTitle>
          {brief.oneLine ? <RefText text={brief.oneLine} style={{ color: colors.text, fontSize: font.sizes.md, fontStyle: 'italic', lineHeight: 22 }} /> : null}
          <View style={{ gap: 6 }}>
            {facts.map((f) => (
              <View key={f.label} style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Text style={{ width: 78, color: colors.textFaint, fontSize: font.sizes.sm, fontWeight: '700' }}>{f.label}</Text>
                <RefText text={f.value ?? ''} style={{ flex: 1, color: colors.text, fontSize: font.sizes.sm, lineHeight: 20 }} />
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {brief.summaryBefore ? <Section title="Before this passage">{brief.summaryBefore}</Section> : null}
      {brief.setting ? <Section title="The scene & setting">{brief.setting}</Section> : null}

      {brief.speakerAudience ? <Section title="Who's speaking to whom">{brief.speakerAudience}</Section> : null}

      {brief.characters.length > 0 ? (
        <Section title="Characters">
          <View style={{ gap: spacing.sm }}>
            {brief.characters.map((c, i) => (
              <View key={i}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>{c.name}</Text>
                <RefText text={c.insight} style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 22 }} />
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
                <RefText text={w.insight} style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 22 }} />
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {brief.discussionQuestions.length > 0 ? (
        <Section title="Discussion questions">
          <View style={{ gap: spacing.sm }}>
            {brief.discussionQuestions.map((q, i) => (
              <RefText key={i} text={`${i + 1}. ${q}`} style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24 }} />
            ))}
          </View>
        </Section>
      ) : null}

      {brief.crossReferences.length > 0 ? (
        <Section title="Related passages">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {brief.crossReferences.map((r) => (
              <PeekableRef key={r} reference={r} />
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

/** Real history/geography/culture — the AI names topics, the server returns cited Wikipedia summaries. */
function HistoryContext({ passage, serverUrl }: { passage: string; serverUrl: string | null }) {
  const { colors } = useTheme();
  const [items, setItems] = useState<StudyContextItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try { setItems(await fetchStudyContext(serverUrl, passage)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load the background.'); }
    finally { setLoading(false); }
  };

  return (
    <Card style={{ marginBottom: spacing.sm, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionTitle style={{ marginBottom: 0 }}>History & context</SectionTitle>
        {items === null ? <Button title={loading ? '…' : 'Show'} variant="secondary" small loading={loading} onPress={load} icon={<Ionicons name="earth" size={15} color={colors.text} />} /> : null}
      </View>
      {error ? <Text style={{ color: colors.warning, fontSize: font.sizes.xs }}>{error.includes('Server URL') ? 'Add your Server URL in Settings to load background.' : error}</Text> : null}
      {items && items.length === 0 ? <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>No background found for this passage.</Text> : null}
      {items?.map((it, i) => (
        <View key={i} style={{ gap: 4, paddingTop: i > 0 ? spacing.sm : 0, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{it.title}</Text>
            <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
              <Text style={{ color: colors.textFaint, fontSize: 10, fontWeight: '700' }}>{it.kind}</Text>
            </View>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 21 }}>{it.extract}</Text>
          <Pressable onPress={() => Linking.openURL(it.url)} hitSlop={6}>
            <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>Read on Wikipedia →</Text>
          </Pressable>
        </View>
      ))}
      {items && items.length > 0 ? <Text style={{ color: colors.textFaint, fontSize: 10 }}>Sourced from Wikipedia — a starting point, not the last word.</Text> : null}
    </Card>
  );
}

/** Grounded conversational follow-up on the passage, savable into Notes. */
function AskPanel({ passage, serverUrl }: { passage: string; serverUrl: string | null }) {
  const { colors } = useTheme();
  const router = useRouter();
  const createDoc = useStore((s) => s.createDoc);
  const [q, setQ] = useState('');
  const [thread, setThread] = useState<{ q: string; a: string; refs: string[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    const question = q.trim();
    if (!question) return;
    setLoading(true);
    setError(null);
    setQ('');
    try {
      const r = await askStudy(serverUrl, passage, question, thread.map((t) => ({ q: t.q, a: t.a })));
      setThread((t) => [...t, { q: question, a: r.answer, refs: validateReferences(r.references) }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not answer that.');
      setQ(question);
    } finally {
      setLoading(false);
    }
  };

  const saveToNotes = () => {
    const md = thread.map((t) => `## ${t.q}\n\n${t.a}${t.refs.length ? `\n\nReferences: ${t.refs.join(', ')}` : ''}`).join('\n\n');
    const id = createDoc('study', { anchorRef: passage, title: `Study — ${passage}`, blocks: markdownToBlocks(md), tags: ['study'] });
    router.push(`/notes/${id}`);
  };

  return (
    <Card style={{ marginBottom: spacing.sm, gap: spacing.sm }}>
      <SectionTitle style={{ marginBottom: 0 }}>Ask about this passage</SectionTitle>

      {thread.map((t, i) => (
        <View key={i} style={{ gap: 6, paddingTop: i > 0 ? spacing.sm : 0, borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.border }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.sm }}>{t.q}</Text>
          <RefText text={t.a} style={{ color: colors.text, fontSize: font.sizes.sm, lineHeight: 22 }} />
          {t.refs.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {t.refs.map((r) => <PeekableRef key={r} reference={r} />)}
            </View>
          ) : null}
        </View>
      ))}

      {thread.length === 0 ? (
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
          Ask a question — “Why does this matter?”, “Who wrote this and when?”, “How does this connect to the cross?”
        </Text>
      ) : null}

      {error ? <Text style={{ color: colors.warning, fontSize: font.sizes.xs }}>{error.includes('Server URL') ? 'Add your Server URL in Settings to ask.' : error}</Text> : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Ask about this passage…"
          placeholderTextColor={colors.textFaint}
          multiline
          onSubmitEditing={ask}
          style={{ flex: 1, color: colors.text, fontSize: font.sizes.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, maxHeight: 100 }}
        />
        <Pressable onPress={ask} disabled={!q.trim() || loading} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: q.trim() && !loading ? colors.primary : colors.surfaceAlt }}>
          {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="arrow-up" size={20} color={q.trim() ? colors.onPrimary : colors.textFaint} />}
        </Pressable>
      </View>

      <Text style={{ color: colors.textFaint, fontSize: 10 }}>Ember’s answers are AI — weigh them against Scripture.</Text>

      {thread.length > 0 ? (
        <Button title="Save to Notes" variant="secondary" small icon={<Ionicons name="bookmark-outline" size={15} color={colors.text} />} onPress={saveToNotes} />
      ) : null}
    </Card>
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
