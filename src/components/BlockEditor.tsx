import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView, NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, spacing, font, radius } from '@/theme';
import { RichText } from '@/components/RichText';
import {
  makeBlock,
  detectShortcut,
  updateBlock,
  setBlockType,
  insertAfter,
  removeBlock,
  moveBlock,
  mergeWithPrevious,
  toggleChecked,
  toggleCollapsed,
} from '@/utils/blocks';
import type { Block, BlockType } from '@/types';

/**
 * A block-based rich editor (the Notes/Notion pillar). Each block is edited as a
 * plain TextInput and rendered read-mode via RichText (inline **bold**, *italic*,
 * and peekable verse chips). Markdown shortcuts transform block type as you type
 * ("# " → heading, "- " → bullet, "[] " → todo, "> " → quote, "| " → callout,
 * ">> " → toggle, "---" → divider); Enter splits, Backspace at start merges.
 *
 * The editor owns `blocks` locally (seeded once) and reports every change up via
 * `onChange` — so controlled re-seeding never fights the caret.
 */
const TYPE_LABELS: { type: BlockType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'paragraph', label: 'Text', icon: 'text-outline' },
  { type: 'h1', label: 'Heading 1', icon: 'chevron-up-circle-outline' },
  { type: 'h2', label: 'Heading 2', icon: 'chevron-up-outline' },
  { type: 'h3', label: 'Heading 3', icon: 'remove-outline' },
  { type: 'bulleted', label: 'Bulleted list', icon: 'ellipse' },
  { type: 'numbered', label: 'Numbered list', icon: 'list-outline' },
  { type: 'todo', label: 'To-do', icon: 'checkbox-outline' },
  { type: 'quote', label: 'Quote', icon: 'chatbox-ellipses-outline' },
  { type: 'callout', label: 'Callout', icon: 'bulb-outline' },
  { type: 'toggle', label: 'Toggle', icon: 'caret-forward-outline' },
  { type: 'divider', label: 'Divider', icon: 'remove' },
];

export function BlockEditor({
  initialBlocks,
  onChange,
  placeholder = 'Write freely — as the Lord leads…',
}: {
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks.length ? initialBlocks : [makeBlock('paragraph', '')]);
  const [editingId, setEditingId] = useState<string | null>(blocks[0]?.id ?? null);
  const [sel, setSel] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const detailEditing = useRef(false);

  const commit = (next: Block[]) => {
    setBlocks(next);
    onChange(next);
  };

  const numberFor = (index: number) => {
    let n = 1;
    for (let k = index - 1; k >= 0 && blocks[k].type === 'numbered'; k--) n++;
    return n;
  };

  const handleChangeText = (id: string, text: string, index: number) => {
    // Enter → split (multiline TextInputs surface Enter as '\n').
    const nl = text.indexOf('\n');
    if (nl !== -1) {
      const before = text.slice(0, nl);
      const after = text.slice(nl + 1);
      const cur = blocks[index];
      const carry = cur.type === 'bulleted' || cur.type === 'numbered' || cur.type === 'todo';
      if (carry && before.trim() === '' && after === '') {
        commit(setBlockType(blocks, id, 'paragraph'));
        return;
      }
      const nb = makeBlock(carry ? cur.type : 'paragraph', after);
      let next = updateBlock(blocks, id, { text: before });
      next = insertAfter(next, id, nb);
      commit(next);
      setEditingId(nb.id);
      setSel({ start: 0, end: 0 });
      return;
    }
    // Markdown block shortcut.
    const sc = detectShortcut(text);
    if (sc && blocks[index].type !== sc.type) {
      if (sc.type === 'divider') {
        const para = makeBlock('paragraph', '');
        let next = blocks.map((b) => (b.id === id ? { ...b, type: 'divider' as BlockType, text: '' } : b));
        next = insertAfter(next, id, para);
        commit(next);
        setEditingId(para.id);
        return;
      }
      commit(blocks.map((b) => (b.id === id ? { ...b, type: sc.type, text: sc.text } : b)));
      return;
    }
    commit(updateBlock(blocks, id, { text }));
  };

  const handleKeyPress = (id: string, index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key !== 'Backspace') return;
    if (sel.start !== 0 || sel.end !== 0) return;
    const b = blocks[index];
    // First backspace demotes a styled, non-empty block to a paragraph.
    if (b.type !== 'paragraph' && b.text !== '') {
      commit(setBlockType(blocks, id, 'paragraph'));
      return;
    }
    const res = mergeWithPrevious(blocks, id);
    if (res.focusId !== id || res.blocks !== blocks) {
      commit(res.blocks);
      setEditingId(res.focusId);
      setSel({ start: res.caret, end: res.caret });
    }
  };

  const addBlockAtEnd = () => {
    const nb = makeBlock('paragraph', '');
    commit([...blocks, nb]);
    setEditingId(nb.id);
  };

  const changeType = (id: string, type: BlockType) => {
    commit(setBlockType(blocks, id, type));
    setMenuFor(null);
  };

  return (
    <View style={{ gap: 2 }}>
      {blocks.map((b, i) => (
        <BlockRow
          key={b.id}
          block={b}
          index={i}
          number={b.type === 'numbered' ? numberFor(i) : undefined}
          editing={editingId === b.id}
          isOnlyEmpty={blocks.length === 1 && !b.text}
          placeholder={placeholder}
          onFocusEdit={() => { setEditingId(b.id); }}
          onChangeText={(t) => handleChangeText(b.id, t, i)}
          onChangeDetail={(t) => commit(updateBlock(blocks, b.id, { detail: t }))}
          onKeyPress={(e) => handleKeyPress(b.id, i, e)}
          onSelectionChange={(s) => setSel(s)}
          onToggleCheck={() => commit(toggleChecked(blocks, b.id))}
          onToggleCollapse={() => commit(toggleCollapsed(blocks, b.id))}
          onOpenMenu={() => setMenuFor(b.id)}
        />
      ))}

      <Pressable onPress={addBlockAtEnd} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: spacing.sm, paddingHorizontal: 4, opacity: 0.6 }}>
        <Ionicons name="add" size={18} color={colors.textFaint} />
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm }}>Add a block</Text>
      </Pressable>

      {/* Per-block menu: turn-into + move + delete */}
      <Modal visible={!!menuFor} transparent animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={() => setMenuFor(null)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: '70%' }}>
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '800', marginBottom: spacing.sm }}>TURN INTO</Text>
            <ScrollView>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {TYPE_LABELS.map((t) => (
                  <Pressable key={t.type} onPress={() => menuFor && changeType(menuFor, t.type)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}>
                    <Ionicons name={t.icon} size={15} color={colors.primary} />
                    <Text style={{ color: colors.text, fontSize: font.sizes.sm, fontWeight: '600' }}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <MenuBtn icon="arrow-up" label="Move up" onPress={() => { if (menuFor) commit(moveBlock(blocks, menuFor, -1)); setMenuFor(null); }} />
              <MenuBtn icon="arrow-down" label="Move down" onPress={() => { if (menuFor) commit(moveBlock(blocks, menuFor, 1)); setMenuFor(null); }} />
              <MenuBtn icon="trash-outline" label="Delete" danger onPress={() => { if (menuFor) commit(removeBlock(blocks, menuFor)); setMenuFor(null); }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuBtn({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}>
      <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.text} />
      <Text style={{ color: danger ? colors.danger : colors.text, fontSize: font.sizes.xs, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

// --- one block row -----------------------------------------------------------

function BlockRow({
  block: b,
  index,
  number,
  editing,
  isOnlyEmpty,
  placeholder,
  onFocusEdit,
  onChangeText,
  onChangeDetail,
  onKeyPress,
  onSelectionChange,
  onToggleCheck,
  onToggleCollapse,
  onOpenMenu,
}: {
  block: Block;
  index: number;
  number?: number;
  editing: boolean;
  isOnlyEmpty: boolean;
  placeholder: string;
  onFocusEdit: () => void;
  onChangeText: (t: string) => void;
  onChangeDetail: (t: string) => void;
  onKeyPress: (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
  onSelectionChange: (s: { start: number; end: number }) => void;
  onToggleCheck: () => void;
  onToggleCollapse: () => void;
  onOpenMenu: () => void;
}) {
  const { colors } = useTheme();

  if (b.type === 'divider') {
    return (
      <Pressable onLongPress={onOpenMenu} style={{ paddingVertical: spacing.md }}>
        <View style={{ height: 1, backgroundColor: colors.border }} />
      </Pressable>
    );
  }

  const textStyle = blockTextStyle(b.type, colors);
  const rowStyle = b.type === 'callout'
    ? { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }
    : b.type === 'quote'
    ? { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: spacing.md }
    : undefined;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 2 }}>
      {/* left handle: open the block menu */}
      <Pressable onPress={onOpenMenu} hitSlop={8} style={{ paddingTop: 6, opacity: 0.4 }}>
        <Ionicons name="reorder-two-outline" size={16} color={colors.textFaint} />
      </Pressable>

      <View style={[{ flex: 1 }, rowStyle]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          {/* prefix adornment */}
          {b.type === 'bulleted' ? <Text style={[textStyle, { width: 16 }]}>•</Text> : null}
          {b.type === 'numbered' ? <Text style={[textStyle, { minWidth: 20 }]}>{number}.</Text> : null}
          {b.type === 'todo' ? (
            <Pressable onPress={onToggleCheck} hitSlop={8} style={{ paddingTop: 3 }}>
              <Ionicons name={b.checked ? 'checkbox' : 'square-outline'} size={18} color={b.checked ? colors.success : colors.textFaint} />
            </Pressable>
          ) : null}
          {b.type === 'callout' ? <Text style={{ fontSize: 15, paddingTop: 2 }}>💡</Text> : null}
          {b.type === 'toggle' ? (
            <Pressable onPress={onToggleCollapse} hitSlop={8} style={{ paddingTop: 3 }}>
              <Ionicons name={b.collapsed ? 'caret-forward' : 'caret-down'} size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}

          {/* content: edit (TextInput) or read (RichText) */}
          <View style={{ flex: 1 }}>
            {editing ? (
              <TextInput
                value={b.text}
                onChangeText={onChangeText}
                onKeyPress={onKeyPress}
                onSelectionChange={(e) => onSelectionChange(e.nativeEvent.selection)}
                autoFocus
                multiline
                placeholder={isOnlyEmpty ? placeholder : undefined}
                placeholderTextColor={colors.textFaint}
                style={[textStyle, { padding: 0, textDecorationLine: b.type === 'todo' && b.checked ? 'line-through' : 'none' }]}
              />
            ) : (
              <Pressable onPress={onFocusEdit}>
                {b.text.trim() ? (
                  <RichText
                    text={b.text}
                    style={[textStyle, b.type === 'todo' && b.checked ? { textDecorationLine: 'line-through', color: colors.textFaint } : null]}
                  />
                ) : (
                  <Text style={[textStyle, { color: colors.textFaint }]}>{isOnlyEmpty ? placeholder : ' '}</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>

        {/* toggle body */}
        {b.type === 'toggle' && !b.collapsed ? (
          editing ? (
            <TextInput
              value={b.detail ?? ''}
              onChangeText={onChangeDetail}
              multiline
              placeholder="Toggle contents…"
              placeholderTextColor={colors.textFaint}
              style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 22, marginLeft: 22, marginTop: 4, padding: 0 }}
            />
          ) : b.detail?.trim() ? (
            <View style={{ marginLeft: 22, marginTop: 4 }}>
              <RichText text={b.detail} style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 22 }} />
            </View>
          ) : null
        ) : null}
      </View>
    </View>
  );
}

function blockTextStyle(type: BlockType, colors: any) {
  switch (type) {
    case 'h1': return { color: colors.text, fontSize: font.sizes.xxl, fontWeight: '800' as const, lineHeight: 34 };
    case 'h2': return { color: colors.text, fontSize: font.sizes.xl, fontWeight: '800' as const, lineHeight: 30 };
    case 'h3': return { color: colors.text, fontSize: font.sizes.lg, fontWeight: '700' as const, lineHeight: 26 };
    case 'quote': return { color: colors.textMuted, fontSize: font.sizes.md, fontStyle: 'italic' as const, lineHeight: 24 };
    case 'callout': return { color: colors.text, fontSize: font.sizes.sm, lineHeight: 22 };
    case 'toggle': return { color: colors.text, fontSize: font.sizes.md, fontWeight: '700' as const, lineHeight: 24 };
    default: return { color: colors.text, fontSize: font.sizes.md, lineHeight: 24 };
  }
}
