import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, spacing, font, radius } from '@/theme';
import { useStore, useTopicList, useTopicsForRef } from '@/store/useStore';

/**
 * Reusable "＋ Add to topic" picker. Opened from anywhere Scripture appears
 * (reader, search, sermon, study). Toggles the verse in/out of a topic, lets you
 * spin up a new topic on the spot, and captures an optional "why this fits" note.
 */
export function AddToTopicSheet({
  visible,
  onClose,
  reference,
}: {
  visible: boolean;
  onClose: () => void;
  reference: string;
}) {
  const { colors } = useTheme();
  const topics = useTopicList();
  const inTopics = useTopicsForRef(reference);
  const inSet = useMemo(() => new Set(inTopics), [inTopics]);

  const addToTopic = useStore((s) => s.addToTopic);
  const removeFromTopic = useStore((s) => s.removeFromTopic);
  const createTopic = useStore((s) => s.createTopic);

  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    if (visible) {
      setNote('');
      setCreating(false);
      setNewTitle('');
    }
  }, [visible, reference]);

  const toggle = (id: string) => {
    if (inSet.has(id)) removeFromTopic(id, reference);
    else addToTopic(id, reference, note);
  };

  const createAndAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    const id = createTopic(title);
    addToTopic(id, reference, note);
    setCreating(false);
    setNewTitle('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={onClose}>
          <Pressable
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: '82%' }}
            onPress={() => {}}
          >
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.lg }}>Add to a topic</Text>
            <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginTop: 2 }}>{reference}</Text>

            {/* Optional "why this fits" note (applies to the next verse you add). */}
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Why this verse fits (optional)…"
              placeholderTextColor={colors.textFaint}
              style={{ color: colors.text, fontSize: font.sizes.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md }}
            />

            <ScrollView style={{ marginTop: spacing.md }} keyboardShouldPersistTaps="handled">
              {topics.length === 0 && !creating ? (
                <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm, textAlign: 'center', paddingVertical: spacing.lg }}>
                  No topics yet. Create one below to start a study thread.
                </Text>
              ) : null}

              {topics.map((t) => {
                const checked = inSet.has(t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => toggle(t.id)}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}
                  >
                    <View style={{ width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: checked ? colors.primary : colors.surfaceAlt, borderWidth: checked ? 0 : 1, borderColor: colors.border }}>
                      {checked ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>{t.title}</Text>
                      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{(t.entries ?? []).length} {((t.entries ?? []).length) === 1 ? 'verse' : 'verses'}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Create-on-the-spot */}
            {creating ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <TextInput
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="New topic name"
                  placeholderTextColor={colors.textFaint}
                  autoFocus
                  onSubmitEditing={createAndAdd}
                  style={{ flex: 1, color: colors.text, fontSize: font.sizes.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}
                />
                <Pressable onPress={createAndAdd} disabled={!newTitle.trim()} style={{ paddingHorizontal: spacing.lg, justifyContent: 'center', backgroundColor: newTitle.trim() ? colors.primary : colors.surfaceAlt, borderRadius: radius.md }}>
                  <Text style={{ color: newTitle.trim() ? colors.onPrimary : colors.textFaint, fontWeight: '800' }}>Add</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setCreating(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, marginTop: spacing.xs }}>
                <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.md }}>New topic</Text>
              </Pressable>
            )}

            <Pressable onPress={onClose} style={{ paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs }}>
              <Text style={{ color: colors.textFaint, fontWeight: '700', fontSize: font.sizes.md }}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
