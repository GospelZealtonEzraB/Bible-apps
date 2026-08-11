import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, EmptyState } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useTopicList, useStore } from '@/store/useStore';

/**
 * Topics — named tags over verses. "Grace", "Names of God", "The Rapture".
 * Nothing to write here: a topic is only a title and the Scripture gathered
 * under it. Writing lives in Notes.
 */
export default function TopicsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const topics = useTopicList();
  const createTopic = useStore((s) => s.createTopic);

  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const create = () => {
    const t = title.trim();
    if (!t) return;
    const id = createTopic(t);
    setTitle('');
    setCreating(false);
    router.push(`/topics/${id}`);
  };

  return (
    <Screen>
      <Header title="Topics" subtitle="Verses gathered under a theme" back />

      {creating ? (
        <Card style={{ gap: spacing.sm }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Name it — e.g. “Grace”, “Waiting on God”"
            placeholderTextColor={colors.textFaint}
            autoFocus
            style={{ color: colors.text, fontSize: font.sizes.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => { setTitle(''); setCreating(false); }} />
            <Button title="Create" small style={{ flex: 1 }} disabled={!title.trim()} onPress={create} />
          </View>
        </Card>
      ) : (
        <Button
          title="New topic"
          variant="secondary"
          icon={<Ionicons name="add" size={18} color={colors.text} />}
          onPress={() => setCreating(true)}
        />
      )}

      {topics.length === 0 && !creating ? (
        <Card>
          <EmptyState
            emoji="🏷️"
            title="No topics yet"
            subtitle="While you read, tap a verse → “Add to a topic” to start gathering."
          />
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {topics.map((t) => (
            <Card key={t.id} onPress={() => router.push(`/topics/${t.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="pricetag" size={17} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{t.title}</Text>
                <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
                  {t.entries.length} verse{t.entries.length === 1 ? '' : 's'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
