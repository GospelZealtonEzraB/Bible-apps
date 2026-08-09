import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, SectionTitle } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { booksByTestament, bookByNumber } from '@/data/structure';
import { useReadingPosition, useSettings, useActiveReadingPlanId, useReadingPlanProgress } from '@/store/useStore';
import { translationName } from '@/data/bibleApi';
import { getReadingPlan } from '@/data/readingPlans';
import type { BookInfo } from '@/data/books';

export default function ReadScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { ot, nt } = booksByTestament();
  const reading = useReadingPosition();
  const translation = useSettings((s) => s.readerTranslation);
  const activePlanId = useActiveReadingPlanId();
  const activePlanProgress = useReadingPlanProgress(activePlanId ?? undefined);
  const activePlan = getReadingPlan(activePlanId);

  const resumeBook = reading ? bookByNumber(reading.book) : undefined;

  let planSubtitle = 'Read through the Word, day by day';
  if (activePlan) {
    const done = activePlanProgress?.completed.length ?? 0;
    const current = activePlan.days.findIndex((_, i) => !(activePlanProgress?.completed ?? []).includes(i));
    planSubtitle = current === -1 ? `${activePlan.title} · complete 🎉` : `${activePlan.title} · Day ${current + 1} of ${activePlan.days.length}`;
    void done;
  }

  return (
    <Screen>
      <Header
        title="Read"
        subtitle={`The Word · ${translationName(translation)}`}
        right={
          <Pressable
            onPress={() => router.push('/search')}
            hitSlop={12}
            style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}
          >
            <Ionicons name="search" size={20} color={colors.text} />
          </Pressable>
        }
      />

      {reading && resumeBook ? (
        <Card onPress={() => router.push(`/read/${reading.book}/${reading.chapter}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="book" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <SectionTitle style={{ marginBottom: 2 }}>Continue reading</SectionTitle>
            <Text style={{ color: colors.text, fontSize: font.sizes.lg, fontWeight: '800' }}>
              {resumeBook.name} {reading.chapter}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
        </Card>
      ) : null}

      <Card onPress={() => router.push('/plans')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="calendar-outline" size={22} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <SectionTitle style={{ marginBottom: 2 }}>Reading plans</SectionTitle>
          <Text style={{ color: colors.text, fontSize: font.sizes.md, fontWeight: '700' }}>{planSubtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
      </Card>

      <Card onPress={() => router.push('/hymns')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="musical-notes-outline" size={22} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <SectionTitle style={{ marginBottom: 2 }}>Hymns</SectionTitle>
          <Text style={{ color: colors.text, fontSize: font.sizes.md, fontWeight: '700' }}>Sing the Word — lyrics & chords</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
      </Card>

      <Card onPress={() => router.push('/sermon')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="mic-outline" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <SectionTitle style={{ marginBottom: 2 }}>Sermon notes</SectionTitle>
          <Text style={{ color: colors.text, fontSize: font.sizes.md, fontWeight: '700' }}>Summarize a message & pull its verses</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
      </Card>

      <Card onPress={() => router.push('/topics')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="pricetag-outline" size={22} color={colors.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <SectionTitle style={{ marginBottom: 2 }}>Study topics</SectionTitle>
          <Text style={{ color: colors.text, fontSize: font.sizes.md, fontWeight: '700' }}>Collect verses on a theme as you read</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
      </Card>

      <BookGroup title="Old Testament" books={ot} onPick={(b) => router.push(`/read/${b.n}`)} />
      <BookGroup title="New Testament" books={nt} onPick={(b) => router.push(`/read/${b.n}`)} />
    </Screen>
  );
}

function BookGroup({ title, books, onPick }: { title: string; books: BookInfo[]; onPick: (b: BookInfo) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionTitle>{title}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {books.map((b) => (
          <Pressable
            key={b.n}
            onPress={() => onPick(b)}
            style={({ pressed }) => ({
              paddingVertical: spacing.sm + 2,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.primarySoft : colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            })}
          >
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: font.sizes.sm }}>{b.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
