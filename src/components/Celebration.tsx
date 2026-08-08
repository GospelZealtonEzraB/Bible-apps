import React, { useEffect } from 'react';
import { Modal, View, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useRecentBadgeId, useStore } from '@/store/useStore';
import { badgeById } from '@/gamification';
import { QUEST_BONUS_XP } from '@/quests';
import { useTheme, spacing, font, radius } from '@/theme';
import { Ember } from '@/components/Ember';
import { Confetti } from '@/components/Confetti';

/**
 * Global overlay that celebrates a newly earned badge or finishing all daily
 * quests. Mounted once at the root; auto-dismisses.
 */
export function Celebration() {
  const { colors } = useTheme();
  const badgeId = useRecentBadgeId();
  const questComplete = useStore((s) => s.recentQuestComplete);
  const clear = useStore((s) => s.clearCelebration);
  const badge = badgeId ? badgeById(badgeId) : undefined;
  const show = !!badge || questComplete;

  useEffect(() => {
    if (!show) return;
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // ignore
      }
    }
    const t = setTimeout(clear, 3200);
    return () => clearTimeout(t);
  }, [show, clear]);

  if (!show) return null;

  const eyebrow = badge ? 'BADGE UNLOCKED' : 'DAILY QUESTS DONE';
  const emoji = badge ? badge.emoji : '🎯';
  const title = badge ? badge.name : 'All quests complete!';
  const subtitle = badge ? badge.description : `Nice work today. +${QUEST_BONUS_XP} XP bonus!`;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={clear}>
      <Pressable
        onPress={clear}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <Confetti />
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing.xl,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            maxWidth: 320,
          }}
        >
          <Ember mood="celebrating" size={110} />
          <Text style={{ color: colors.accent, fontWeight: '800', letterSpacing: 1, marginTop: spacing.sm }}>
            {eyebrow}
          </Text>
          <Text style={{ fontSize: 40, marginVertical: spacing.xs }}>{emoji}</Text>
          <Text style={{ color: colors.text, fontSize: font.sizes.xl, fontWeight: '800' }}>
            {title}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              textAlign: 'center',
              marginTop: 4,
              fontSize: font.sizes.sm,
            }}
          >
            {subtitle}
          </Text>
          <Pressable
            onPress={clear}
            style={{
              marginTop: spacing.lg,
              backgroundColor: colors.primary,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.pill,
            }}
          >
            <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Keep going!</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
