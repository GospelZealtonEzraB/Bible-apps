import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, SectionTitle } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { READING_PLANS, getReadingPlan } from '@/data/readingPlans';
import { parsePassage } from '@/data/books';
import { useStore, useActiveReadingPlanId, useReadingPlanProgress } from '@/store/useStore';

export default function PlansScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const activeId = useActiveReadingPlanId();
  const startReadingPlan = useStore((s) => s.startReadingPlan);

  const active = getReadingPlan(activeId);

  const openPassage = (ref: string) => {
    const p = parsePassage(ref);
    if (p) router.push(`/read/${p.bookNumber}/${p.chapter}`);
  };

  return (
    <Screen>
      <Header title="Reading plans" subtitle="Read through the Word, day by day" back />

      {active ? <ActivePlanCard planId={active.id} onOpenPassage={openPassage} /> : null}

      <SectionTitle>{active ? 'Switch plan' : 'Choose a plan'}</SectionTitle>
      <View style={{ gap: spacing.sm }}>
        {READING_PLANS.map((plan) => {
          const isActive = plan.id === activeId;
          return (
            <Card key={plan.id} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{plan.title}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>{plan.description}</Text>
                  <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: 2 }}>{plan.days.length} days</Text>
                </View>
              </View>
              <Button
                title={isActive ? 'Following' : 'Start this plan'}
                variant={isActive ? 'secondary' : 'primary'}
                small
                disabled={isActive}
                onPress={() => startReadingPlan(plan.id)}
              />
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

function ActivePlanCard({ planId, onOpenPassage }: { planId: string; onOpenPassage: (ref: string) => void }) {
  const { colors } = useTheme();
  const plan = getReadingPlan(planId)!;
  const progress = useReadingPlanProgress(planId);
  const toggleReadingDay = useStore((s) => s.toggleReadingDay);

  const completed = progress?.completed ?? [];
  const completedSet = new Set(completed);
  // Current day = the first not-yet-completed day (self-paced, "as the Lord leads").
  let currentDay = plan.days.findIndex((_, i) => !completedSet.has(i));
  const allDone = currentDay === -1;
  if (allDone) currentDay = plan.days.length - 1;

  const pct = Math.round((completed.length / plan.days.length) * 100);
  const dayPassages = plan.days[currentDay] ?? [];
  const isTodayDone = completedSet.has(currentDay);

  return (
    <Card style={{ gap: spacing.md, borderColor: colors.primary }}>
      <View>
        <SectionTitle style={{ marginBottom: 2 }}>{plan.title}</SectionTitle>
        <Text style={{ color: colors.text, fontSize: font.sizes.lg, fontWeight: '800' }}>
          {allDone ? '🎉 Plan complete!' : `Day ${currentDay + 1} of ${plan.days.length}`}
        </Text>
      </View>

      {/* progress bar */}
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: 8, backgroundColor: colors.primary }} />
      </View>
      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
        {completed.length} / {plan.days.length} days · {pct}%
      </Text>

      {!allDone ? (
        <>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, fontWeight: '700' }}>Today's reading</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {dayPassages.map((ref) => (
              <Chip key={ref} label={ref} onPress={() => onOpenPassage(ref)} />
            ))}
          </View>
          <Button
            title={isTodayDone ? 'Marked done — undo' : 'Mark today complete'}
            variant={isTodayDone ? 'secondary' : 'primary'}
            small
            icon={<Ionicons name={isTodayDone ? 'checkmark-done' : 'checkmark'} size={16} color={isTodayDone ? colors.text : colors.onPrimary} />}
            onPress={() => toggleReadingDay(planId, currentDay)}
          />
        </>
      ) : null}
    </Card>
  );
}
