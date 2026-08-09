import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, spacing, font, radius } from '@/theme';
import { useStore, useTopicList } from '@/store/useStore';
import { normalizeKey } from '@/data/bibleApi';
import type { Topic } from '@/types';

/**
 * Reusable "＋ Add to topic" picker. Opened from anywhere Scripture appears
 * (reader, search, sermon, study). Works for a single verse or a whole
 * multi-verse selection: toggles the verse(s) in/out of a topic, lets you spin
 * up a new topic on the spot, and captures an optional "why this fits" note.
 */
export function AddToTopicSheet({
  visible,
  onClose,
  reference,
  references,
}: {
  visible: boolean;
  onClose: () => void;
  reference?: string;
  /** A multi-verse selection. Takes precedence over `reference` when non-empty. */
  references?: string[];
}) {
  const { colors } = useTheme();
  const topics = useTopicList();

  const refs = useMemo(() => {
    const list = references && references.length ? references : reference ? [reference] : [];
    return Array.from(new Set(list.map((r) => r.trim()).filter(Boolean)));
  }, [references, reference]);

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
  }, [visible, refs.join('|')]);

  // How many of the selected refs a topic already contains (for the checkbox state).
  const countIn = (t: Topic): number => {
    const keys = new Set((t.entries ?? []).map((e) => normalizeKey(e.ref)));
    return refs.filter((r) => keys.has(normalizeKey(r))).length;
  };

  const toggle = (t: Topic) => {
    const inCount = countIn(t);
    if (inCount === refs.length) {
      refs.forEach((r) => removeFromTopic(t.id, r)); // all in → remove all
    } else {
      refs.forEach((r) => addToTopic(t.id, r, note)); // add the missing ones (add is a dedupe no-op for present ones)
    }
  };

  const createAndAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    const id = createTopic(title);
    refs.forEach((r) => addToTopic(id, r, note));
    setCreating(false);
    setNewTitle('');
  };

  const heading = refs.length > 1 ? `Add ${refs.length} verses to a topic` : 'Add to a topic';
  const sub = refs.length > 1 ? `${refs[0]} … ${refs[refs.length - 1]}` : refs[0] ?? '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={onClose}>
          <Pressable
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: '82%' }}
            onPress={() => {}}
          >
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.lg }}>{heading}</Text>
            <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginTop: 2 }}>{sub}</Text>

            {/* Optional "why this fits" note (applies to the verses you add). */}
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Why these verses fit (optional)…"
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
                const inCount = countIn(t);
                const allIn = inCount === refs.length && refs.length > 0;
                const partial = inCount > 0 && !allIn;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => toggle(t)}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}
                  >
                    <View style={{ width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: allIn ? colors.primary : partial ? colors.primarySoft : colors.surfaceAlt, borderWidth: allIn ? 0 : 1, borderColor: colors.border }}>
                      {allIn ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : partial ? <Ionicons name="remove" size={16} color={colors.primary} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>{t.title}</Text>
                      <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
                        {(t.entries ?? []).length} {((t.entries ?? []).length) === 1 ? 'verse' : 'verses'}{partial ? ` · ${inCount}/${refs.length} selected here` : ''}
                      </Text>
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
