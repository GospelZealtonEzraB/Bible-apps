import React from 'react';
import { View, Text, Pressable, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Chip, SectionTitle, Button } from '@/components/ui';
import { useTheme, spacing, font } from '@/theme';
import { useStore, useSettings, useStats } from '@/store/useStore';
import { TRANSLATIONS } from '@/data/bibleApi';
import { scheduleDailyReminder, cancelDailyReminder } from '@/notifications';
import type { ThemePreference } from '@/types';

const REMINDER_TIMES = ['07:00', '08:00', '12:00', '18:00', '21:00'];
const THEMES: { key: ThemePreference; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const settings = useSettings((s) => s);
  const stats = useStats();
  const setSettings = useStore((s) => s.setSettings);
  const setDailyGoal = useStore((s) => s.setDailyGoal);
  const resetAll = useStore((s) => s.resetAll);

  const onPickReminder = async (time: string | null) => {
    if (time === null) {
      await cancelDailyReminder();
      setSettings({ reminderTime: null });
      return;
    }
    const ok = await scheduleDailyReminder(time);
    if (ok) {
      setSettings({ reminderTime: time });
    } else if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Reminders work on the iOS/Android app, not the web preview.');
    } else {
      Alert.alert('Permission needed', 'Enable notifications for Engraved to get reminders.');
    }
  };

  const confirmReset = () => {
    Alert.alert(
      'Reset everything',
      'This permanently deletes all saved verses and progress. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => resetAll() },
      ],
    );
  };

  return (
    <Screen>
      <Header title="Settings" />

      {/* Translation */}
      <View>
        <SectionTitle>Translation</SectionTitle>
        <Card>
          <View style={{ gap: spacing.sm }}>
            {TRANSLATIONS.map((t) => {
              const active = settings.translation === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setSettings({ translation: t.id })}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? colors.primary : colors.textFaint}
                  />
                  <Text style={{ color: colors.text, fontSize: font.sizes.md, marginLeft: spacing.sm }}>
                    {t.name}
                  </Text>
                  <Text style={{ color: colors.textFaint, marginLeft: spacing.sm }}>
                    ({t.id})
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: spacing.sm }}>
            Applies to verses you add next. Public-domain translations via bible-api.com.
          </Text>
        </Card>
      </View>

      {/* Daily goal */}
      <View>
        <SectionTitle>Daily review goal</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontSize: font.sizes.md }}>
              {stats.dailyGoal} verses / day
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Stepper icon="remove" onPress={() => setDailyGoal(stats.dailyGoal - 1)} />
              <Stepper icon="add" onPress={() => setDailyGoal(stats.dailyGoal + 1)} />
            </View>
          </View>
        </Card>
      </View>

      {/* Reminder */}
      <View>
        <SectionTitle>Daily reminder</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Chip label="Off" active={!settings.reminderTime} onPress={() => onPickReminder(null)} />
            {REMINDER_TIMES.map((t) => (
              <Chip
                key={t}
                label={t}
                active={settings.reminderTime === t}
                onPress={() => onPickReminder(t)}
              />
            ))}
          </View>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: spacing.sm }}>
            A gentle nudge to review your verses and keep your streak.
          </Text>
        </Card>
      </View>

      {/* Theme */}
      <View>
        <SectionTitle>Appearance</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {THEMES.map((t) => (
              <Chip
                key={t.key}
                label={t.label}
                active={settings.theme === t.key}
                onPress={() => setSettings({ theme: t.key })}
              />
            ))}
          </View>
        </Card>
      </View>

      {/* Danger zone */}
      <View>
        <SectionTitle>Data</SectionTitle>
        <Button title="Reset all data" variant="danger" onPress={confirmReset} />
      </View>

      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, textAlign: 'center' }}>
        Engraved · "Your word I have hidden in my heart" — Psalm 119:11
      </Text>
    </Screen>
  );
}

function Stepper({ icon, onPress }: { icon: 'add' | 'remove'; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}
