import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, SectionTitle, SpeechBubble } from '@/components/ui';
import { Ember } from '@/components/Ember';
import { useTheme, spacing, font, radius } from '@/theme';
import { useVerseList, useActiveReadingPlanId, useReadingPlanProgress } from '@/store/useStore';
import { getReadingPlan } from '@/data/readingPlans';
import { parsePassage } from '@/data/books';
import { isDue } from '@/srs/sm2';

// Gentle, unattributed prompts to still the heart before the Word.
const PRESENCE_PROMPTS = [
  'Lord, quiet my heart. Open my eyes to see wonderful things in Your Word.',
  'Holy Spirit, be my teacher today — lead me into all truth.',
  'Speak, Lord; Your servant is listening.',
  'Father, I come not just to read, but to meet with You. Draw near.',
  'Still me, Lord. Let me wait on You before I begin.',
];

function Movement({ icon, color, title, children }: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <SectionTitle style={{ marginBottom: 0 }}>{title}</SectionTitle>
      </View>
      {children}
    </Card>
  );
}

export default function AbideScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const verses = useVerseList();
  const activeId = useActiveReadingPlanId();
  const progress = useReadingPlanProgress(activeId ?? undefined);
  const plan = getReadingPlan(activeId);

  const due = verses.filter((v) => isDue(v.srs)).length;
  const prompt = PRESENCE_PROMPTS[new Date().getDate() % PRESENCE_PROMPTS.length];

  let todaysPassages: string[] = [];
  if (plan) {
    const done = new Set(progress?.completed ?? []);
    const current = plan.days.findIndex((_, i) => !done.has(i));
    if (current !== -1) todaysPassages = plan.days[current];
  }

  const openPassage = (ref: string) => {
    const p = parsePassage(ref);
    if (p) router.push(`/read/${p.bookNumber}/${p.chapter}`);
  };

  return (
    <Screen>
      <Header title="Abide" subtitle="A quiet time, at your pace" back />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Ember mood="praying" size={64} />
        <SpeechBubble>Unhurried is the pace. Linger where He leads — skip what you need to.</SpeechBubble>
      </Card>

      {/* Come — presence */}
      <Movement icon="sparkles-outline" color={colors.primary} title="Come — be still">
        <Text style={{ color: colors.text, fontSize: font.sizes.md, fontFamily: font.serif, fontStyle: 'italic', lineHeight: 26 }}>
          "{prompt}"
        </Text>
      </Movement>

      {/* Word — reading */}
      <Movement icon="book-outline" color={colors.accent} title="The Word — read">
        {todaysPassages.length > 0 ? (
          <>
            <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>Today's reading</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {todaysPassages.map((ref) => <Chip key={ref} label={ref} onPress={() => openPassage(ref)} />)}
            </View>
          </>
        ) : (
          <Button title="Open the Bible" variant="secondary" small icon={<Ionicons name="book" size={16} color={colors.text} />} onPress={() => router.push('/read')} />
        )}
      </Movement>

      {/* Respond — memorize + review */}
      <Movement icon="heart-outline" color={colors.success} title="Hide it — memorize & review">
        {due > 0 ? (
          <Button title={`Review ${due} verse${due === 1 ? '' : 's'}`} small icon={<Ionicons name="play" size={16} color={colors.onPrimary} />} onPress={() => router.push('/review')} />
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>All caught up on review. Pick a verse from today's reading to hide in your heart.</Text>
        )}
      </Movement>

      {/* Close — pray */}
      <Movement icon="leaf-outline" color={colors.primary} title="Respond & close">
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.md, lineHeight: 24 }}>
          Name one way you'll live this out today — then close in prayer, thanking Him for meeting you.
        </Text>
      </Movement>

      <Button title="Amen — done for now" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
