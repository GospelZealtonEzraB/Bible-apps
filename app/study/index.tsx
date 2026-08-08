import React, { useMemo, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore } from '@/store/useStore';
import { parsePassage, formatPassage } from '@/data/books';

export default function StudyIndexScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const studySessions = useStore((s) => s.studySessions);

  const [passage, setPassage] = useState('');

  const recent = useMemo(
    () => Object.values(studySessions).sort((a, b) => b.fetchedAt - a.fetchedAt).slice(0, 6),
    [studySessions],
  );

  const start = () => {
    const p = parsePassage(passage);
    if (!p) return;
    router.push(`/study/${encodeURIComponent(formatPassage(p))}`);
  };

  const valid = !!parsePassage(passage);

  return (
    <Screen>
      <Header title="Bible study" subtitle="Set the scene for today's passage" back />

      <Card>
        <SectionTitle>What are you reading today?</SectionTitle>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md }}>
          <Ionicons name="book-outline" size={18} color={colors.textFaint} />
          <TextInput
            value={passage}
            onChangeText={setPassage}
            placeholder="A chapter or passage — e.g. John 3 or John 3:1-21"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="words"
            returnKeyType="go"
            onSubmitEditing={start}
            style={{ flex: 1, color: colors.text, fontSize: font.sizes.md, paddingVertical: spacing.md }}
          />
        </View>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: spacing.sm }}>
          AI sets the context: what came before, the scene, the people, who's speaking to whom, plus
          discussion questions and word studies. It never quotes Scripture — the text comes from your
          Bible translation.
        </Text>
        <View style={{ marginTop: spacing.md }}>
          <Button title="Set the scene" onPress={start} disabled={!valid} icon={<Ionicons name="sparkles" size={16} color={colors.onPrimary} />} />
        </View>
      </Card>

      {recent.length > 0 ? (
        <View>
          <SectionTitle>Recent studies</SectionTitle>
          <View style={{ gap: spacing.sm }}>
            {recent.map((s) => (
              <Card key={s.passageKey} onPress={() => router.push(`/study/${encodeURIComponent(s.passage)}`)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Ionicons name="reader-outline" size={20} color={colors.primary} />
                  <Text style={{ flex: 1, color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>{s.passage}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </View>
              </Card>
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
