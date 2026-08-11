import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle, EmptyState } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useCircle, useStore, useVerseList } from '@/store/useStore';
import { parseReference, formatReference } from '@/data/books';
import type { ChallengeKind } from '@/types';

const KINDS: { key: ChallengeKind; label: string; hint: string }[] = [
  { key: 'recite', label: 'Recite it', hint: 'Type the verse from memory' },
  { key: 'meaning', label: 'What it means', hint: 'Say it in your own words' },
];

/**
 * Send your partner a challenge. It posts as a card in the conversation — they
 * tap "Take it" there, and their answer comes back to the same thread.
 * Grace-first by design: there's no score to lose.
 */
export default function NewChallengeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; to?: string }>();
  const code = typeof params.code === 'string' ? params.code : '';
  const circle = useCircle(code);
  const myId = useStore((s) => s.profile.memberId);
  const assignChallenge = useStore((s) => s.assignChallenge);
  const verses = useVerseList();

  const partner = useMemo(
    () => (circle?.members ?? []).find((m) => m.id === params.to) ?? (circle?.members ?? []).find((m) => m.id !== myId),
    [circle?.members, params.to, myId],
  );

  const [ref, setRef] = useState('');
  const [kind, setKind] = useState<ChallengeKind>('recite');
  const [sending, setSending] = useState(false);

  const parsed = parseReference(ref.trim());
  const canSend = !!parsed && !!partner;

  const send = async () => {
    if (!parsed || !partner) return;
    setSending(true);
    try {
      await assignChallenge(code, partner.id, partner.displayName, formatReference(parsed), kind);
      router.back();
    } catch (e) {
      Alert.alert('Couldn’t send it', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!partner) {
    return (
      <Screen>
        <Header title="Challenge" back />
        <EmptyState emoji="🎯" title="No partner yet" subtitle="Once someone joins, you can challenge each other." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={`Challenge ${partner.displayName}`} subtitle="It lands in your conversation" back />

      <Card style={{ gap: spacing.sm }}>
        <SectionTitle>Which verse?</SectionTitle>
        <TextInput
          value={ref}
          onChangeText={setRef}
          placeholder="e.g. Romans 8:28"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="words"
          autoFocus
          style={{ color: colors.text, fontSize: font.sizes.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}
        />
        {ref.trim() && !parsed ? (
          <Text style={{ color: colors.warning, fontSize: font.sizes.xs }}>That doesn’t look like a reference yet.</Text>
        ) : null}

        {verses.length > 0 ? (
          <>
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700', marginTop: 4 }}>
              OR PICK FROM YOURS
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {verses.slice(0, 8).map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => setRef(v.reference)}
                  style={{ paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: ref === v.reference ? colors.primary : colors.surfaceAlt }}
                >
                  <Text style={{ color: ref === v.reference ? colors.onPrimary : colors.textMuted, fontSize: font.sizes.xs, fontWeight: '700' }}>
                    {v.reference}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </Card>

      <View>
        <SectionTitle>What are you asking?</SectionTitle>
        <View style={{ gap: spacing.sm }}>
          {KINDS.map((k) => (
            <Pressable key={k.key} onPress={() => setKind(k.key)}>
              <Card
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  borderColor: kind === k.key ? colors.primary : colors.border,
                  borderWidth: kind === k.key ? 1.5 : 1,
                }}
              >
                <Ionicons
                  name={kind === k.key ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={kind === k.key ? colors.primary : colors.textFaint}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{k.label}</Text>
                  <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{k.hint}</Text>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      </View>

      <Button
        title={sending ? 'Sending…' : 'Send the challenge'}
        loading={sending}
        disabled={!canSend || sending}
        icon={<Ionicons name="send" size={17} color={colors.onPrimary} />}
        onPress={send}
      />
      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, textAlign: 'center' }}>
        There's no score to lose — this is for encouragement, not a contest.
      </Text>
    </Screen>
  );
}
