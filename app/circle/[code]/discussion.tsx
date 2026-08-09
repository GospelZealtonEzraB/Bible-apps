import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Header } from '@/components/layout';
import { EmptyState } from '@/components/ui';
import { RefText } from '@/components/RefText';
import { useTheme, spacing, font, radius } from '@/theme';
import { useCircle, useStore } from '@/store/useStore';
import type { Message } from '@/types';

export default function DiscussionScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code: string }>();
  const code = typeof params.code === 'string' ? params.code : '';
  const circle = useCircle(code);
  const myId = useStore((s) => s.profile.memberId);
  const refreshCircle = useStore((s) => s.refreshCircle);
  const postCircleMessage = useStore((s) => s.postCircleMessage);
  const deleteCircleMessage = useStore((s) => s.deleteCircleMessage);

  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Message>>(null);
  const messages = circle?.messages ?? [];

  useEffect(() => { refreshCircle(code).catch(() => {}); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    postCircleMessage(code, t).catch(() => {});
    setDraft('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const confirmDelete = (m: Message) =>
    Alert.alert('Delete message?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCircleMessage(code, m.msgId) },
    ]);

  const renderItem = ({ item: m }: { item: Message }) => {
    const mine = m.by === myId;
    return (
      <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: spacing.sm }}>
        {!mine ? <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginBottom: 2, marginLeft: 4 }}>{m.byName}</Text> : null}
        <Pressable
          onLongPress={mine ? () => confirmDelete(m) : undefined}
          style={{ maxWidth: '82%', backgroundColor: mine ? colors.primary : colors.surface, borderWidth: mine ? 0 : 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}
        >
          <RefText text={m.text} style={{ color: mine ? colors.onPrimary : colors.text }} />
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Header title="Discussion" subtitle={circle?.meta.name ? `${circle.meta.name} · talk it through` : 'Talk it through'} back />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        {messages.length === 0 ? (
          <EmptyState emoji="💬" title="No messages yet" subtitle="Start the conversation — share what the Lord is showing you. Type a reference like John 3:16 to link it." />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.msgId}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
          />
        )}

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor={colors.textFaint}
            multiline
            style={{ flex: 1, color: colors.text, fontSize: font.sizes.md, maxHeight: 120, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
          />
          <Pressable onPress={send} disabled={!draft.trim()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: draft.trim() ? colors.primary : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="send" size={18} color={draft.trim() ? colors.onPrimary : colors.textFaint} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
