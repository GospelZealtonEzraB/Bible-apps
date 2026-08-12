import React, { useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle, SpeechBubble } from '@/components/ui';
import { Ember } from '@/components/Ember';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore, useProfile } from '@/store/useStore';

/**
 * What the Chat tab shows before there is anyone to talk to: set your name,
 * then either start a partnership and send the code, or enter the one you were
 * given. Nothing else — the whole "Together" hub is gone.
 */
export default function PartnerSetupScreen() {
  const { colors } = useTheme();
  const profile = useProfile();
  const setDisplayName = useStore((s) => s.setDisplayName);
  const createCircle = useStore((s) => s.createCircle);
  const joinCircle = useStore((s) => s.joinCircle);

  const [name, setName] = useState(profile.displayName);
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const needsName = !profile.displayName.trim();

  const onCreate = async () => {
    setCreating(true);
    try {
      // No navigation: the Chat tab renders the conversation as soon as the
      // partnership exists.
      await createCircle();
    } catch (e) {
      Alert.alert('Couldn’t start it', e instanceof Error ? e.message : 'Please try again.');
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
    } catch (e) {
      Alert.alert('Couldn’t join', e instanceof Error ? e.message : 'Check the code and try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen>
      <Header title="Your partner" subtitle="One person, walking with you" />

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        <Ember mood="content" size={64} />
        <View style={{ flex: 1 }}>
          <SpeechBubble>
            Two are better than one. Invite the person you want to grow with — you'll see each other's
            days, and this is where you'll talk.
          </SpeechBubble>
        </View>
      </View>

      {needsName ? (
        <Card style={{ gap: spacing.sm }}>
          <SectionTitle>What should they call you?</SectionTitle>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="words"
            style={inputStyle(colors)}
          />
          <Button title="Save" small disabled={!name.trim()} onPress={() => setDisplayName(name.trim())} />
        </Card>
      ) : null}

      <Card style={{ gap: spacing.sm }}>
        <SectionTitle>Start one</SectionTitle>
        <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
          You'll get a six-character code to send them.
        </Text>
        <Button
          title={creating ? 'Starting…' : 'Start a partnership'}
          loading={creating}
          disabled={needsName}
          icon={<Ionicons name="add" size={18} color={colors.onPrimary} />}
          onPress={onCreate}
        />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <SectionTitle>Or join theirs</SectionTitle>
        <TextInput
          value={joinCode}
          onChangeText={setJoinCode}
          placeholder="Enter their code (e.g. FA7K2Q)"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          style={inputStyle(colors)}
        />
        <Button
          title={joining ? 'Joining…' : 'Join'}
          variant="secondary"
          loading={joining}
          disabled={!joinCode.trim() || needsName}
          onPress={onJoin}
        />
      </Card>
    </Screen>
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
