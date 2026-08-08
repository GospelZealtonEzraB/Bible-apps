import React, { useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle, EmptyState } from '@/components/ui';
import { Ember } from '@/components/Ember';
import { useTheme, spacing, font, radius } from '@/theme';
import { useProfile, useStore } from '@/store/useStore';

export default function TogetherScreen() {
  const { colors } = useTheme();
  const profile = useProfile();
  const setDisplayName = useStore((s) => s.setDisplayName);
  const restoreFromBackup = useStore((s) => s.restoreFromBackup);

  const [name, setName] = useState(profile.displayName);
  const [editingName, setEditingName] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');

  const hasName = !!profile.displayName;

  const saveName = () => {
    if (!name.trim()) return;
    setDisplayName(name);
    setEditingName(false);
  };

  const onRestore = () => {
    const ok = restoreFromBackup(restoreCode);
    if (ok) {
      setRestoreCode('');
      setShowRestore(false);
      Alert.alert('Identity restored', 'This device now uses your transfer code.');
    } else {
      Alert.alert('That code doesn’t look right', 'A transfer code looks like “m_…”. Check and try again.');
    }
  };

  return (
    <Screen>
      <Header title="Growing Together" subtitle="Grow with a faith partner" />

      <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
        <Ember mood="proud" size={92} />
      </View>

      {/* Identity / name */}
      {!hasName || editingName ? (
        <Card>
          <SectionTitle>Your name</SectionTitle>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginBottom: spacing.sm }}>
            This is how your partner will see you.
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sarah"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={saveName}
            style={{
              color: colors.text,
              fontSize: font.sizes.md,
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
            }}
          />
          <View style={{ marginTop: spacing.md }}>
            <Button title="Save name" onPress={saveName} disabled={!name.trim()} />
          </View>
        </Card>
      ) : (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>You’re known here as</Text>
              <Text style={{ color: colors.text, fontSize: font.sizes.lg, fontWeight: '800' }}>
                {profile.displayName}
              </Text>
            </View>
            <Button title="Edit" variant="secondary" small onPress={() => { setName(profile.displayName); setEditingName(true); }} />
          </View>
        </Card>
      )}

      {/* Circles (arriving in Phase 2) */}
      <View>
        <SectionTitle>Your circles</SectionTitle>
        <Card>
          <EmptyState
            emoji="🤝"
            title="Invite a partner in faith"
            subtitle="Soon you’ll create a circle and share an invite code — then memorize, study, pray, and keep each other accountable. Set your name above to get ready."
          />
        </Card>
      </View>

      {/* Transfer code */}
      <View>
        <SectionTitle>Transfer code</SectionTitle>
        <Card>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginBottom: spacing.sm }}>
            Save this code somewhere safe. Enter it on a new phone to keep your identity and circles.
          </Text>
          <View
            style={{
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
            }}
          >
            <Text selectable style={{ color: colors.text, fontSize: font.sizes.md, fontWeight: '700', letterSpacing: 0.5 }}>
              {profile.backupCode || '—'}
            </Text>
          </View>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: spacing.sm }}>
            Tap and hold the code to copy it.
          </Text>

          {showRestore ? (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <TextInput
                value={restoreCode}
                onChangeText={setRestoreCode}
                placeholder="Paste a transfer code (m_…)"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  color: colors.text,
                  fontSize: font.sizes.md,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                }}
              />
              <Button title="Restore identity" onPress={onRestore} disabled={!restoreCode.trim()} />
            </View>
          ) : (
            <View style={{ marginTop: spacing.md }}>
              <Button title="Restore from another device" variant="secondary" small onPress={() => setShowRestore(true)} />
            </View>
          )}
        </Card>
      </View>
    </Screen>
  );
}
