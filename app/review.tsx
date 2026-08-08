import React, { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Button, EmptyState } from '@/components/ui';
import { Ember } from '@/components/Ember';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore, useVerse, useStats } from '@/store/useStore';
import { isDue, type RecallRating } from '@/srs/sm2';

const RATINGS: { key: RecallRating; label: string; color: keyof ReturnType<typeof useTheme>['colors'] }[] = [
  { key: 'again', label: 'Again', color: 'danger' },
  { key: 'hard', label: 'Hard', color: 'warning' },
  { key: 'good', label: 'Good', color: 'primary' },
  { key: 'easy', label: 'Easy', color: 'success' },
];

export default function ReviewScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const gradeReview = useStore((s) => s.gradeReview);
  const stats = useStats();

  // Snapshot the due queue once so grading doesn't reshuffle it mid-session.
  const [queue] = useState<string[]>(() => {
    const verses = Object.values(useStore.getState().verses);
    return verses
      .filter((v) => isDue(v.srs))
      .sort((a, b) => a.srs.dueDate - b.srs.dueDate)
      .map((v) => v.id);
  });

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const current = useVerse(queue[index]);
  const finished = index >= queue.length;

  const grade = (rating: RecallRating) => {
    if (!current) return;
    gradeReview(current.id, rating);
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {
        // ignore
      }
    }
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  const close = () => router.back();

  // Empty queue
  if (queue.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <EmptyState
          emoji="✅"
          title="Nothing due right now"
          subtitle="Come back later, or practice a verse from your library."
          action={<Button title="Close" onPress={close} />}
        />
      </SafeAreaView>
    );
  }

  // Session complete
  if (finished) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md }}>
          <Ember mood="celebrating" size={130} />
          <Text style={{ color: colors.text, fontSize: font.sizes.xxl, fontWeight: '800' }}>
            Review complete!
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center', maxWidth: 300 }}>
            {`You reviewed ${queue.length} verse${queue.length === 1 ? '' : 's'}. Streak: ${stats.streak} day${stats.streak === 1 ? '' : 's'} 🔥`}
          </Text>
          <Button title="Done" onPress={close} style={{ marginTop: spacing.sm }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Progress header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        <View style={{ flex: 1, height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4 }}>
          <View
            style={{
              width: `${(index / queue.length) * 100}%`,
              height: 8,
              backgroundColor: colors.primary,
              borderRadius: 4,
            }}
          />
        </View>
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, fontWeight: '600' }}>
          {index + 1}/{queue.length}
        </Text>
        <Pressable onPress={close} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
        <Pressable
          onPress={() => setRevealed(true)}
          style={{
            flex: 1,
            marginVertical: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.xl,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.primary, fontSize: font.sizes.xl, fontWeight: '800' }}>
            {current?.reference}
          </Text>
          {revealed ? (
            <Text
              style={{
                color: colors.text,
                fontSize: font.sizes.lg,
                lineHeight: 30,
                textAlign: 'center',
                marginTop: spacing.xl,
                fontFamily: font.serif,
              }}
            >
              "{current?.text}"
            </Text>
          ) : (
            <Text style={{ color: colors.textFaint, marginTop: spacing.xl }}>
              Recite it, then tap to reveal
            </Text>
          )}
        </Pressable>

        {revealed ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: font.sizes.sm }}>
              How well did you remember it?
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {RATINGS.map((r) => (
                <Pressable
                  key={r.key}
                  onPress={() => grade(r.key)}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    backgroundColor: colors.surfaceAlt,
                    borderBottomWidth: 3,
                    borderBottomColor: colors[r.color],
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <Button title="Show verse" onPress={() => setRevealed(true)} />
        )}
      </View>
    </SafeAreaView>
  );
}
