import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, EmptyState } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useTopicList, useStore } from '@/store/useStore';

/**
 * Custom study topics — tag-as-you-read collections ("The Rapture", "Grace").
 * Private to this device for now; a topic can be studied, memorized as a set,
 * or (later) shared to a circle as a collaborative study.
 */
export default function TopicsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const topics = useTopicList();
  const createTopic = useStore((s) => s.createTopic);

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

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
      <Header
        title="Study topics"
        subtitle="Collect verses on a theme as you read"
        back
        right={
          <Pressable onPress={() => setCreating((v) => !v)} hitSlop={10} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
            <Ionicons name={creating ? 'close' : 'add'} size={22} color={colors.text} />
          </Pressable>
        }
      />

      {creating ? (
        <Card style={{ gap: spacing.sm }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Topic name — e.g. The Rapture, Grace, Names of God"
            placeholderTextColor={colors.textFaint}
            autoFocus
            onSubmitEditing={create}
            style={{ color: colors.text, fontSize: font.sizes.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}
          />
          <Button title="Create topic" onPress={create} disabled={!title.trim()} icon={<Ionicons name="add" size={18} color={colors.onPrimary} />} />
        </Card>
      ) : null}

      {topics.length === 0 && !creating ? (
        <EmptyState
          emoji="🏷️"
          title="No topics yet"
          subtitle="Start a topic, then tap ‘Add to a topic’ on any verse as you read to collect it here."
          action={<Button title="New topic" onPress={() => setCreating(true)} icon={<Ionicons name="add" size={18} color={colors.onPrimary} />} />}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {topics.map((t) => {
            const count = (t.entries ?? []).length;
            return (
              <Card key={t.id} onPress={() => router.push(`/topics/${t.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="pricetag" size={20} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{t.title}</Text>
                  <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
                    {count} {count === 1 ? 'verse' : 'verses'}{t.description ? ` · ${t.description}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
