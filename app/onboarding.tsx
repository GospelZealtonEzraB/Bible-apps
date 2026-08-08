import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, SpeechBubble } from '@/components/ui';
import { Ember, type EmberMood } from '@/components/Ember';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore, useProfile, useSettings } from '@/store/useStore';
import { getVerse } from '@/data/bibleApi';

/** A one-tap suggested first verse. */
const SUGGESTED = [
  { ref: 'John 3:16', label: 'John 3:16' },
  { ref: 'Philippians 4:6-7', label: 'Philippians 4:6-7' },
  { ref: 'Psalm 23:1', label: 'Psalm 23:1' },
  { ref: 'Proverbs 3:5-6', label: 'Proverbs 3:5-6' },
];

interface StepDef {
  mood: EmberMood;
  speech: string;
  title: string;
  body: string;
}

const STEPS: StepDef[] = [
  {
    mood: 'waving',
    speech: 'Hi, I’m Ember!',
    title: 'Welcome to Versed',
    body: 'I’ll be right here as you hide God’s Word in your heart, one verse at a time. Let’s take a quick look around.',
  },
  {
    mood: 'reading',
    speech: 'Here’s how we’ll learn.',
    title: 'Learn it, then keep it',
    body: 'Playful drills help a verse stick, and gentle spaced-repetition reviews bring it back just before you’d forget — so it stays with you for good.',
  },
  {
    mood: 'excited',
    speech: 'What should I call you?',
    title: 'Your name',
    body: 'This is how faith partners will see you when you grow together. You can change it anytime.',
  },
  {
    mood: 'content',
    speech: 'Let’s plant your first one.',
    title: 'Your first verse',
    body: 'Pick one to start with. I’ll add it to your library so we can begin today.',
  },
  {
    mood: 'love',
    speech: 'Better together.',
    title: 'Grow together',
    body: 'Invite a friend or small group to a circle — assign each other verses, pray together, and cheer one another on. Ready?',
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const profile = useProfile();
  const serverUrl = useSettings((s) => s.serverUrl);
  const translation = useSettings((s) => s.translation);
  const setDisplayName = useStore((s) => s.setDisplayName);
  const setSettings = useStore((s) => s.setSettings);
  const addFetchedVerse = useStore((s) => s.addFetchedVerse);

  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.displayName ?? '');
  const [addingRef, setAddingRef] = useState<string | null>(null);
  const [addedRef, setAddedRef] = useState<string | null>(null);

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const finish = () => {
    if (name.trim()) setDisplayName(name.trim());
    setSettings({ onboarded: true });
    router.replace('/(tabs)');
  };

  const next = () => {
    if (step === 2 && name.trim()) setDisplayName(name.trim());
    if (isLast) finish();
    else setStep((n) => n + 1);
  };

  const addFirstVerse = async (ref: string) => {
    if (addingRef) return;
    setAddingRef(ref);
    try {
      const fetched = await getVerse(ref, translation, { serverUrl });
      addFetchedVerse(fetched);
      setAddedRef(ref);
    } catch (e) {
      Alert.alert(
        'Couldn’t reach that one',
        e instanceof Error ? e.message : 'You can add a verse later from the Add tab.',
      );
    } finally {
      setAddingRef(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'space-between' }}>
        {/* Top: skip + progress dots */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === step ? 22 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === step ? colors.primary : colors.surfaceAlt,
                }}
              />
            ))}
          </View>
          <Pressable onPress={finish} hitSlop={10}>
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm, fontWeight: '600' }}>Skip</Text>
          </Pressable>
        </View>

        {/* Middle: Ember + content */}
        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          <Ember mood={s.mood} size={140} react={step + 1} />
          <View style={{ flexDirection: 'row', alignSelf: 'stretch' }}>
            <SpeechBubble>{s.speech}</SpeechBubble>
          </View>

          <View style={{ alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm }}>
            <Text style={{ color: colors.text, fontSize: font.sizes.xxl, fontWeight: '800', textAlign: 'center' }}>
              {s.title}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: font.sizes.md, textAlign: 'center', lineHeight: 22 }}>
              {s.body}
            </Text>
          </View>

          {/* Step 2: name input */}
          {step === 2 ? (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name or nickname"
              placeholderTextColor={colors.textFaint}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={next}
              style={{
                alignSelf: 'stretch',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                color: colors.text,
                fontSize: font.sizes.lg,
                textAlign: 'center',
              }}
            />
          ) : null}

          {/* Step 3: first verse chips */}
          {step === 3 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
              {SUGGESTED.map((v) => {
                const isAdded = addedRef === v.ref;
                const isBusy = addingRef === v.ref;
                return (
                  <Pressable
                    key={v.ref}
                    onPress={() => addFirstVerse(v.ref)}
                    disabled={!!addingRef || isAdded}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.pill,
                      backgroundColor: isAdded ? colors.primary : colors.surface,
                      borderWidth: 1,
                      borderColor: isAdded ? colors.primary : colors.border,
                      opacity: isBusy ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: isAdded ? colors.onPrimary : colors.text, fontWeight: '700' }}>
                      {isAdded ? `✓ ${v.label}` : isBusy ? `Adding ${v.label}…` : v.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Bottom: nav */}
        <View style={{ gap: spacing.sm }}>
          <Button
            title={isLast ? 'Start growing' : step === 3 && !addedRef ? 'Skip for now' : 'Next'}
            onPress={next}
          />
          {step > 0 ? (
            <Button title="Back" variant="ghost" onPress={() => setStep((n) => Math.max(0, n - 1))} />
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
