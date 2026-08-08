import React from 'react';
import { View, Text, Pressable, Alert, Platform, TextInput, Switch, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Chip, SectionTitle, Button } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore, useSettings, useStats } from '@/store/useStore';
import { TRANSLATIONS } from '@/data/bibleApi';
import { DEFAULT_SERVER_URL, resolveServerUrl } from '@/config';
import { relativeTimeAgo } from '@/utils/date';
import {
  scheduleDailyReminder,
  cancelDailyReminder,
  NOTIFICATIONS_SUPPORTED,
} from '@/notifications';
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
    if (!NOTIFICATIONS_SUPPORTED) {
      Alert.alert(
        'Reminders need the installed app',
        'Daily reminders work once Versed is built as a real app (an EAS/dev build) — not in Expo Go or the web preview. Your choice is saved and will activate there.',
      );
      setSettings({ reminderTime: time });
      return;
    }
    const ok = await scheduleDailyReminder(time);
    if (ok) {
      setSettings({ reminderTime: time });
    } else {
      Alert.alert('Permission needed', 'Enable notifications for Versed to get reminders.');
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
            Applies to verses you add next.
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

      {/* AI & Server */}
      <View>
        <SectionTitle>Smart features</SectionTitle>
        <Card>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginBottom: spacing.sm }}>
            {DEFAULT_SERVER_URL
              ? 'AI memory hooks, verse explanations, and verse suggestions are ready to use. This field is optional — set it only to point the app at your own server instead of the built-in one.'
              : 'Paste your deployed server URL to unlock AI memory hooks, verse explanations, and verse suggestions. See server/README.md to deploy one.'}
          </Text>
          <TextInput
            value={settings.serverUrl ?? ''}
            onChangeText={(t) => setSettings({ serverUrl: t.trim() ? t.trim() : null })}
            placeholder={DEFAULT_SERVER_URL ?? 'https://engraved-server.you.workers.dev'}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={{
              color: colors.text,
              fontSize: font.sizes.md,
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
            }}
          />
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: spacing.sm }}>
            {resolveServerUrl(settings.serverUrl)
              ? settings.serverUrl
                ? 'AI features are enabled (using your custom server).'
                : 'AI features are enabled (using the built-in server).'
              : 'Optional — the app works fully without it.'}
          </Text>
        </Card>
      </View>

      {/* Circle sharing */}
      <View>
        <SectionTitle>Sharing with your circle</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>
                Share my memorized verses
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginTop: 2 }}>
                Let circle partners see which verses you’ve memorized and are learning. Off = they see
                only your counts.
              </Text>
            </View>
            <Switch
              value={settings.shareLibrary}
              onValueChange={(v) => setSettings({ shareLibrary: v })}
              trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
            />
          </View>
        </Card>
      </View>

      {/* Back up & restore */}
      <BackupCard />

      {/* Danger zone */}
      <View>
        <SectionTitle>Reset</SectionTitle>
        <Button title="Reset all data" variant="danger" onPress={confirmReset} />
      </View>

      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, textAlign: 'center' }}>
        Versed · "Your word I have hidden in my heart" — Psalm 119:11
      </Text>
    </Screen>
  );
}

function BackupCard() {
  const { colors } = useTheme();
  const exportBackup = useStore((s) => s.exportBackup);
  const importBackup = useStore((s) => s.importBackup);
  const cloudBackup = useStore((s) => s.cloudBackup);
  const lastCloudBackupAt = useStore((s) => s.lastCloudBackupAt);
  const [restoring, setRestoring] = React.useState(false);
  const [pasted, setPasted] = React.useState('');
  const [backingUp, setBackingUp] = React.useState(false);

  const onCloudBackup = async () => {
    setBackingUp(true);
    try {
      await cloudBackup();
      Alert.alert('Backed up', 'Your data is safely saved to the cloud, tied to your transfer code.');
    } finally {
      setBackingUp(false);
    }
  };

  const onBackUp = async () => {
    try {
      await Share.share({
        message: exportBackup(),
        title: 'Versed backup',
      });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  };

  const onRestore = () => {
    if (!pasted.trim()) return;
    Alert.alert(
      'Restore from this backup?',
      'This replaces your current verses, progress, and circles with the backup.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            const res = importBackup(pasted);
            if (res.ok) {
              setPasted('');
              setRestoring(false);
              Alert.alert('Restored', 'Your data has been restored from the backup.');
            } else {
              Alert.alert('Couldn’t restore', res.error ?? 'Please check the backup text.');
            }
          },
        },
      ],
    );
  };

  return (
    <View>
      <SectionTitle>Back up &amp; restore</SectionTitle>
      <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginBottom: spacing.sm }}>
        Your data is auto-saved to the cloud and tied to your transfer code — on a new phone, enter that
        code in the Together tab to bring everything back. You can also save a manual copy below.
      </Text>
      <Button
        title={backingUp ? 'Backing up…' : 'Back up to cloud now'}
        loading={backingUp}
        icon={<Ionicons name="cloud-upload-outline" size={16} color={colors.onPrimary} />}
        onPress={onCloudBackup}
      />
      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: 6, marginBottom: spacing.sm }}>
        {lastCloudBackupAt ? `Last cloud backup ${relativeTimeAgo(lastCloudBackupAt)}.` : 'Not backed up to the cloud yet.'}
      </Text>
      <Button
        title="Save a copy to my phone"
        variant="secondary"
        icon={<Ionicons name="download-outline" size={16} color={colors.text} />}
        onPress={onBackUp}
      />
      {restoring ? (
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <TextInput
            value={pasted}
            onChangeText={setPasted}
            placeholder="Paste your backup text here…"
            placeholderTextColor={colors.textFaint}
            multiline
            style={{
              color: colors.text,
              fontSize: font.sizes.sm,
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.md,
              padding: spacing.md,
              minHeight: 90,
            }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => { setRestoring(false); setPasted(''); }} />
            <Button title="Restore" small style={{ flex: 1 }} disabled={!pasted.trim()} onPress={onRestore} />
          </View>
        </View>
      ) : (
        <View style={{ marginTop: spacing.sm }}>
          <Button title="Restore from a backup" variant="ghost" small onPress={() => setRestoring(true)} />
        </View>
      )}
    </View>
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
