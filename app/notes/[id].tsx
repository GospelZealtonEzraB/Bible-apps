import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, Share, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '@/components/layout';
import { Chip } from '@/components/ui';
import { BlockEditor } from '@/components/BlockEditor';
import { useTheme, spacing, font, radius } from '@/theme';
import { useDoc, useStore } from '@/store/useStore';
import { docToMarkdown, docPreview } from '@/utils/blocks';
import { AssetActions } from '@/components/AssetActions';
import type { Block, DocType } from '@/types';

const TYPE_META: Record<DocType, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  note: { label: 'Note', icon: 'document-text-outline' },
  study: { label: 'Study', icon: 'sparkles-outline' },
  sermon: { label: 'Teaching', icon: 'mic-outline' },
};

export default function DocScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const doc = useDoc(id);
  const updateDoc = useStore((s) => s.updateDoc);
  const deleteDoc = useStore((s) => s.deleteDoc);

  const [tagDraft, setTagDraft] = useState('');
  const [tagsOpen, setTagsOpen] = useState(false);

  // Seed the editor once (BlockEditor owns its blocks after mount).
  const initialBlocks = useMemo<Block[]>(() => doc?.blocks ?? [], [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Header title="Note" back />
          <Text style={{ color: colors.textFaint, marginTop: spacing.lg }}>This note was deleted.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const meta = TYPE_META[doc.type] ?? TYPE_META.note;

  const onExport = async () => {
    try { await Share.share({ message: docToMarkdown({ ...doc }) }); } catch {}
  };

  const confirmDelete = () =>
    Alert.alert('Delete this note?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteDoc(doc.id); router.back(); } },
    ]);

  const addTag = () => {
    const t = tagDraft.trim().replace(/^#/, '');
    if (t && !doc.tags.includes(t)) updateDoc(doc.id, { tags: [...doc.tags, t] });
    setTagDraft('');
  };
  const removeTag = (t: string) => updateDoc(doc.id, { tags: doc.tags.filter((x) => x !== t) });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Header
          title=""
          back
          right={
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Pressable onPress={onExport} hitSlop={8}><Ionicons name="share-outline" size={20} color={colors.textMuted} /></Pressable>
              <Pressable onPress={confirmDelete} hitSlop={8}><Ionicons name="trash-outline" size={20} color={colors.textMuted} /></Pressable>
            </View>
          }
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 }} keyboardShouldPersistTaps="handled">
        {/* type + who can see it — your partner can, unless you say otherwise */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
          <Ionicons name={meta.icon} size={14} color={colors.textFaint} />
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>{meta.label}</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => updateDoc(doc.id, { private: !doc.private })} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name={doc.private ? 'lock-closed' : 'people-outline'} size={14} color={doc.private ? colors.textFaint : colors.primary} />
            <Text style={{ color: doc.private ? colors.textFaint : colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>
              {doc.private ? 'Private' : 'Partner can see'}
            </Text>
          </Pressable>
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <AssetActions asset={{ kind: 'note', assetId: doc.id, title: doc.title || 'Note', text: docPreview(doc) }} />
        </View>

        {/* title */}
        <TextInput
          value={doc.title}
          onChangeText={(t) => updateDoc(doc.id, { title: t })}
          placeholder="Untitled"
          placeholderTextColor={colors.textFaint}
          style={{ color: colors.text, fontSize: font.sizes.xxl, fontWeight: '800', paddingVertical: spacing.sm }}
          multiline
        />

        {/* tags */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
          {doc.tags.map((t) => (
            <Pressable key={t} onPress={() => removeTag(t)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
              <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>#{t}</Text>
              <Ionicons name="close" size={12} color={colors.textFaint} />
            </Pressable>
          ))}
          {tagsOpen ? (
            <TextInput
              value={tagDraft}
              onChangeText={setTagDraft}
              onSubmitEditing={addTag}
              onBlur={() => { addTag(); setTagsOpen(false); }}
              placeholder="tag"
              placeholderTextColor={colors.textFaint}
              autoFocus
              style={{ color: colors.text, fontSize: font.sizes.xs, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.sm, minWidth: 60 }}
            />
          ) : (
            <Pressable onPress={() => setTagsOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="add" size={13} color={colors.textFaint} />
              <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>tag</Text>
            </Pressable>
          )}
        </View>

        {/* the editor */}
        <BlockEditor
          initialBlocks={initialBlocks}
          onChange={(blocks) => updateDoc(doc.id, { blocks })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
