import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, SectionTitle, EmptyState, SpeechBubble } from '@/components/ui';
import { Ember } from '@/components/Ember';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStudySession, useApplication, useStore } from '@/store/useStore';
import { fetchStudyBrief } from '@/data/studyClient';
import { getChapterVerses, normalizeKey, isLatinTranslation, type ChapterVerse } from '@/data/bibleApi';
import type { StudyBrief } from '@/types';

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
  const [verses, setVerses] = useState<ChapterVerse[] | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  const loadPassage = () => {
    setLoadingText(true);
    setTextError(null);
    getChapterVerses(passage, translation, { serverUrl })
      .then((r) => setVerses(r.verses))
      .catch((e) => setTextError(e instanceof Error ? e.message : 'Could not load the passage.'))
      .finally(() => setLoadingText(false));
  };

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

      {/* Read the actual passage (provider text) */}
      <Card style={{ marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionTitle style={{ marginBottom: 0 }}>Read the passage</SectionTitle>
          {!verses ? <Button title={loadingText ? '…' : 'Show verses'} variant="secondary" small loading={loadingText} onPress={loadPassage} /> : null}
        </View>
        {textError ? <Text style={{ color: colors.warning, fontSize: font.sizes.xs, marginTop: spacing.sm }}>{textError}</Text> : null}
        {verses ? (
          <View style={{ marginTop: spacing.sm, gap: 6 }}>
            {verses.map((v) => (
              <Text key={v.verse} style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 26, fontFamily: isLatinTranslation(translation) ? font.serif : undefined }}>
                <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{v.verse} </Text>
                {v.text}
              </Text>
            ))}
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
  const [text, setText] = useState('');

  if (application) {
    return (
      <Card>
        <SectionTitle>Living it out</SectionTitle>
        <Text style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24 }}>✅ {application.text}</Text>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: 4 }}>
          We’ll check back with you on this.
        </Text>
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
        style={{ color: colors.text, fontSize: font.sizes.md, minHeight: 70, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}
      />
      <View style={{ marginTop: spacing.md }}>
        <Button title="Save my commitment" onPress={() => text.trim() && addApplication(passageKey, passage, text)} disabled={!text.trim()} />
      </View>
    </Card>
  );
}
