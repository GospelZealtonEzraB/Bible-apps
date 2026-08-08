import React, { useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle, EmptyState, SpeechBubble } from '@/components/ui';
import { Ember } from '@/components/Ember';
import { useTheme, spacing, font, radius } from '@/theme';
import { useProfile, useCircleList, useStore } from '@/store/useStore';
import type { Circle } from '@/types';

export default function TogetherScreen() {
  const { colors } = useTheme();
  const profile = useProfile();
  const circles = useCircleList();
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

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        <Ember mood={circles.length > 0 ? 'excited' : 'content'} size={78} />
        <SpeechBubble>
          {circles.length > 0
            ? "Growing together beats growing alone. Let's check in on each other!"
            : 'Invite a friend and spur one another on toward love and good deeds.'}
        </SpeechBubble>
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
            style={inputStyle(colors)}
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

      {/* Circles */}
      {hasName ? (
        <CirclesSection circles={circles} />
      ) : (
        <View>
          <SectionTitle>Your circles</SectionTitle>
          <Card>
            <EmptyState
              emoji="🤝"
              title="Set your name to begin"
              subtitle="Once you’ve chosen a name, you can create a circle and invite a partner to grow together."
            />
          </Card>
        </View>
      )}

      {/* Transfer code */}
      <View>
        <SectionTitle>Transfer code</SectionTitle>
        <Card>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginBottom: spacing.sm }}>
            Save this code somewhere safe. Enter it on a new phone to keep your identity and circles.
          </Text>
          <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
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
                style={inputStyle(colors)}
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

function CirclesSection({ circles }: { circles: Circle[] }) {
  const { colors } = useTheme();
  const router = useRouter();
  const createCircle = useStore((s) => s.createCircle);
  const joinCircle = useStore((s) => s.joinCircle);

  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const onCreate = async () => {
    setCreating(true);
    try {
      const code = await createCircle(newName.trim() || undefined);
      setNewName('');
      router.push(`/circle/${code}`);
    } catch (e) {
      Alert.alert('Couldn’t create the circle', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const onJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoining(true);
    try {
      await joinCircle(code);
      setJoinCode('');
      router.push(`/circle/${code}`);
    } catch (e) {
      Alert.alert('Couldn’t join', e instanceof Error ? e.message : 'Check the code and try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View>
        <SectionTitle>Your circles</SectionTitle>
        {circles.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
              No circles yet. Create one and share the code, or join a partner’s below.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {circles.map((c) => (
              <Card key={c.meta.code} onPress={() => router.push(`/circle/${c.meta.code}`)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="people" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{c.meta.name}</Text>
                    <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
                      Code {c.meta.code} · {c.members.length} {c.members.length === 1 ? 'member' : 'members'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      <Card>
        <SectionTitle>Create a circle</SectionTitle>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Name it (e.g. Me & Sarah)"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="words"
          style={inputStyle(colors)}
        />
        <View style={{ marginTop: spacing.md }}>
          <Button title={creating ? 'Creating…' : 'Create circle'} onPress={onCreate} loading={creating} icon={<Ionicons name="add" size={18} color={colors.onPrimary} />} />
        </View>
      </Card>

      <Card>
        <SectionTitle>Join with a code</SectionTitle>
        <TextInput
          value={joinCode}
          onChangeText={setJoinCode}
          placeholder="Enter invite code (e.g. FA7K2Q)"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          style={inputStyle(colors)}
        />
        <View style={{ marginTop: spacing.md }}>
          <Button title={joining ? 'Joining…' : 'Join circle'} variant="secondary" onPress={onJoin} loading={joining} disabled={!joinCode.trim()} />
        </View>
      </Card>
    </View>
  );
}

function inputStyle(colors: ReturnType<typeof useTheme>['colors']) {
  return {
    color: colors.text,
    fontSize: font.sizes.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  } as const;
}
