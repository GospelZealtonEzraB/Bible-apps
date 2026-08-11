import React, { useState } from 'react';
import { View, Text, TextInput, Alert, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle, EmptyState } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useCircle, useStore } from '@/store/useStore';

/**
 * Everything about the partnership that isn't the conversation: the invite
 * code, the covenant you've agreed, the name, and leaving. Reached from the ⋮
 * in the chat header — the contact-info screen of a messaging app.
 */
export default function PartnershipSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const code = typeof params.code === 'string' ? params.code : '';
  const circle = useCircle(code);

  const setCircleName = useStore((s) => s.setCircleName);
  const setCircleCovenant = useStore((s) => s.setCircleCovenant);
  const leaveCircle = useStore((s) => s.leaveCircle);

  const [name, setName] = useState(circle?.meta.name ?? '');
  const [cadence, setCadence] = useState(circle?.meta.covenant?.cadenceLabel ?? '');
  const [goal, setGoal] = useState(circle?.meta.covenant?.goalText ?? '');

  if (!circle) {
    return (
      <Screen>
        <Header title="Partnership" back />
        <EmptyState emoji="🔗" title="Not found" subtitle="This partnership isn’t on this device." />
      </Screen>
    );
  }

  const invite = () =>
    Share.share({
      message: `Let's grow together in the Word. Open Versed and join with my code: ${code}`,
    }).catch(() => {});

  const saveCovenant = () => {
    void setCircleCovenant(code, cadence.trim(), goal.trim()).catch(() => {});
    Alert.alert('Covenant saved 💛', 'It stays pinned at the top of your conversation.');
  };

  const confirmLeave = () =>
    Alert.alert('Leave this partnership?', 'Your own verses, notes and log stay with you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => { void leaveCircle(code).catch(() => {}); router.replace('/chat'); },
      },
    ]);

  return (
    <Screen>
      <Header title="Partnership" subtitle={circle.meta.name} back />

      <Card style={{ gap: spacing.sm }}>
        <SectionTitle>Invite code</SectionTitle>
        <Text style={{ color: colors.primary, fontSize: font.sizes.xxl, fontWeight: '800', letterSpacing: 3 }}>{code}</Text>
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
          Send this to the person you want beside you. They enter it once.
        </Text>
        <Button title="Share the code" icon={<Ionicons name="share-outline" size={18} color={colors.onPrimary} />} onPress={invite} />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <SectionTitle>Our covenant</SectionTitle>
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
          What you're committing to together. It stays pinned above your conversation.
        </Text>
        <TextInput
          value={goal}
          onChangeText={setGoal}
          placeholder="e.g. Meet with Him daily and tell each other honestly"
          placeholderTextColor={colors.textFaint}
          multiline
          style={inputStyle(colors)}
        />
        <TextInput
          value={cadence}
          onChangeText={setCadence}
          placeholder="How often we check in — e.g. every Sunday"
          placeholderTextColor={colors.textFaint}
          style={inputStyle(colors)}
        />
        <Button title="Save covenant" variant="secondary" disabled={!goal.trim()} onPress={saveCovenant} />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <SectionTitle>Name</SectionTitle>
        <TextInput value={name} onChangeText={setName} placeholderTextColor={colors.textFaint} style={inputStyle(colors)} />
        <Button
          title="Rename"
          variant="secondary"
          disabled={!name.trim() || name.trim() === circle.meta.name}
          onPress={() => void setCircleName(code, name.trim()).catch(() => {})}
        />
      </Card>

      <Button title="Leave this partnership" variant="ghost" onPress={confirmLeave} />
    </Screen>
  );
}

function inputStyle(colors: ReturnType<typeof useTheme>['colors']) {
  return {
    color: colors.text,
    fontSize: font.sizes.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  } as const;
}
