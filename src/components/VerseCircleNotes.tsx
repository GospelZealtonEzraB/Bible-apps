import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, SectionTitle } from '@/components/ui';
import { RefText } from '@/components/RefText';
import { useShareToCircle } from '@/components/useShareToCircle';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore } from '@/store/useStore';
import { circleNotesForRef } from '@/utils/notes';

/**
 * Shared notes on a verse from the user's circles — the "learn from others" seam.
 * See what your circle sees, "add their insight to mine" (adopt), and share your
 * own note. Only renders when the user is in at least one circle.
 */
export function VerseCircleNotes({ reference }: { reference: string }) {
  const { colors } = useTheme();
  const circles = useStore((s) => s.circles);
  const myId = useStore((s) => s.profile.memberId);
  const editSharedNote = useStore((s) => s.editSharedNote);
  const deleteSharedNote = useStore((s) => s.deleteSharedNote);
  const addPrivateNote = useStore((s) => s.addPrivateNote);
  const { canShare, share } = useShareToCircle();

  const notes = useMemo(() => circleNotesForRef(circles, reference), [circles, reference]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  if (!canShare) return null; // not in a circle — nothing to share with

  const inputStyle = { color: colors.text, fontSize: font.sizes.md, minHeight: 56, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md } as const;

  const adopt = (text: string, byName: string) => {
    addPrivateNote('verse', `${text}\n\n— ${byName}`, reference);
    Alert.alert('Added to your notes', `Saved ${byName}’s insight to your private notes.`);
  };

  const confirmDelete = (code: string, noteId: string) =>
    Alert.alert('Delete this shared note?', 'It will be removed for the whole circle.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSharedNote(code, noteId) },
    ]);

  return (
    <View>
      <SectionTitle>What your circle sees</SectionTitle>
      <View style={{ gap: spacing.sm }}>
        {notes.map(({ code, note }) => {
          const mine = note.by === myId;
          if (editing === note.noteId) {
            return (
              <Card key={note.noteId} style={{ gap: spacing.sm }}>
                <TextInput value={editDraft} onChangeText={setEditDraft} multiline textAlignVertical="top" style={inputStyle} />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => setEditing(null)} />
                  <Button title="Save" small style={{ flex: 1 }} disabled={!editDraft.trim()} onPress={() => { editSharedNote(code, note.noteId, editDraft, 'verse', reference); setEditing(null); }} />
                </View>
              </Card>
            );
          }
          return (
            <Card key={note.noteId} style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                  <Ionicons name="people" size={12} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>{mine ? 'You' : note.byName}</Text>
                </View>
                {mine ? (
                  <>
                    <Pressable onPress={() => { setEditing(note.noteId); setEditDraft(note.text); }} hitSlop={8} style={{ paddingHorizontal: 4 }}>
                      <Ionicons name="pencil" size={15} color={colors.textFaint} />
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(code, note.noteId)} hitSlop={8} style={{ paddingHorizontal: 4 }}>
                      <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
                    </Pressable>
                  </>
                ) : (
                  <Pressable onPress={() => adopt(note.text, note.byName)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 }}>
                    <Ionicons name="add-circle-outline" size={16} color={colors.success} />
                    <Text style={{ color: colors.success, fontSize: font.sizes.xs, fontWeight: '700' }}>Add to mine</Text>
                  </Pressable>
                )}
              </View>
              <RefText text={note.text} />
            </Card>
          );
        })}

        <Card style={{ gap: spacing.sm }}>
          <TextInput value={draft} onChangeText={setDraft} multiline textAlignVertical="top" style={inputStyle} placeholder="Share an insight with your circle…" placeholderTextColor={colors.textFaint} />
          <Button title="Share with circle" small icon={<Ionicons name="people" size={16} color={colors.onPrimary} />} disabled={!draft.trim()} onPress={() => { share(draft, reference); setDraft(''); }} />
        </Card>
      </View>
    </View>
  );
}
