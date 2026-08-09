import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, SectionTitle } from '@/components/ui';
import { RefText } from '@/components/RefText';
import { useTheme, spacing, font, radius } from '@/theme';
import { useVerseNotes, useStore } from '@/store/useStore';

/**
 * "My notes" on a verse — record what you understand, privately (Personal Space).
 * References typed inside a note become tappable (RefText → VersePeek). Full CRUD.
 * Shared-to-circle notes are a later increment; these stay on-device.
 */
export function VerseNotes({ reference }: { reference: string }) {
  const { colors } = useTheme();
  const notes = useVerseNotes(reference);
  const addPrivateNote = useStore((s) => s.addPrivateNote);
  const editPrivateNote = useStore((s) => s.editPrivateNote);
  const deletePrivateNote = useStore((s) => s.deletePrivateNote);

  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const inputStyle = {
    color: colors.text,
    fontSize: font.sizes.md,
    minHeight: 64,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  } as const;

  const add = () => {
    if (!draft.trim()) return;
    addPrivateNote('verse', draft, reference);
    setDraft('');
  };

  const confirmDelete = (noteId: string) =>
    Alert.alert('Delete this note?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePrivateNote(noteId) },
    ]);

  return (
    <View>
      <SectionTitle>My notes</SectionTitle>
      <View style={{ gap: spacing.sm }}>
        {notes.map((n) =>
          editingId === n.noteId ? (
            <Card key={n.noteId} style={{ gap: spacing.sm }}>
              <TextInput value={editDraft} onChangeText={setEditDraft} multiline textAlignVertical="top" style={inputStyle} placeholder="Your note…" placeholderTextColor={colors.textFaint} />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => setEditingId(null)} />
                <Button title="Save" small style={{ flex: 1 }} disabled={!editDraft.trim()} onPress={() => { editPrivateNote(n.noteId, editDraft); setEditingId(null); }} />
              </View>
            </Card>
          ) : (
            <Card key={n.noteId} style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                  <Ionicons name="lock-closed" size={11} color={colors.textFaint} />
                  <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>Private</Text>
                </View>
                <Pressable onPress={() => { setEditingId(n.noteId); setEditDraft(n.text); }} hitSlop={8} style={{ paddingHorizontal: 4 }}>
                  <Ionicons name="pencil" size={15} color={colors.textFaint} />
                </Pressable>
                <Pressable onPress={() => confirmDelete(n.noteId)} hitSlop={8} style={{ paddingHorizontal: 4 }}>
                  <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
                </Pressable>
              </View>
              <RefText text={n.text} />
            </Card>
          ),
        )}

        <Card style={{ gap: spacing.sm }}>
          <TextInput value={draft} onChangeText={setDraft} multiline textAlignVertical="top" style={inputStyle} placeholder="What is the Lord showing you? Type a reference like John 3:16 to link it." placeholderTextColor={colors.textFaint} />
          <Button title="Add note" small icon={<Ionicons name="add" size={16} color={colors.onPrimary} />} disabled={!draft.trim()} onPress={add} />
        </Card>
      </View>
    </View>
  );
}
