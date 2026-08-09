import React, { useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, spacing, font, radius } from '@/theme';
import { Ember } from '@/components/Ember';
import { useStore } from '@/store/useStore';
import { getHelp } from '@/data/help';

/**
 * The Ember Guide: an ⓘ button that opens a warm, plain-language explainer for a
 * feature (what it is · an example · quick tips), and a first-run EmberTip coach
 * card that appears once per feature. Content lives in src/data/help.ts.
 */

/** A small circular ⓘ button — drop into a Header's `right` slot. */
export function HelpButton({ topic }: { topic: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  if (!getHelp(topic)) return null;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
        <Ionicons name="help" size={20} color={colors.text} />
      </Pressable>
      <HelpSheet topic={topic} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** The explainer sheet — Ember + what/example/tips. */
export function HelpSheet({ topic, visible, onClose }: { topic: string; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const help = getHelp(topic);
  if (!help) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: '80%' }} onPress={() => {}}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
            <Ember mood={help.mood ?? 'content'} size={56} />
            <Text style={{ flex: 1, color: colors.text, fontWeight: '800', fontSize: font.sizes.lg }}>{help.title}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color={colors.textFaint} /></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24 }}>{help.what}</Text>
            {help.example ? (
              <View style={{ marginTop: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}>
                <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '800', marginBottom: 4 }}>FOR EXAMPLE</Text>
                <Text style={{ color: colors.text, fontSize: font.sizes.sm, lineHeight: 22 }}>{help.example}</Text>
              </View>
            ) : null}
            {help.tips && help.tips.length ? (
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                {help.tips.map((t, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Ionicons name="sparkles" size={15} color={colors.primary} style={{ marginTop: 3 }} />
                    <Text style={{ flex: 1, color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 22 }}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * A first-run coach card: shows Ember's one-line tip for a feature the first
 * time it's seen, with "Got it" (dismiss forever) and "Tell me more" (open the
 * full sheet). Renders nothing once dismissed. `id` defaults to the topic.
 */
export function EmberTip({ topic, id }: { topic: string; id?: string }) {
  const { colors } = useTheme();
  const tipId = `tip:${id ?? topic}`;
  const seen = useStore((s) => s.seenTips.includes(tipId));
  const markTipSeen = useStore((s) => s.markTipSeen);
  const [moreOpen, setMoreOpen] = useState(false);
  const help = getHelp(topic);
  if (!help || seen) return null;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.md, alignItems: 'flex-start' }}>
      <Ember mood={help.mood ?? 'waving'} size={48} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Text style={{ color: colors.text, fontSize: font.sizes.sm, lineHeight: 21, fontFamily: font.serif, fontStyle: 'italic' }}>{help.tip}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Pressable onPress={() => markTipSeen(tipId)}><Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.sm }}>Got it</Text></Pressable>
          <Pressable onPress={() => setMoreOpen(true)}><Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: font.sizes.sm }}>Tell me more</Text></Pressable>
        </View>
      </View>
      <HelpSheet topic={topic} visible={moreOpen} onClose={() => setMoreOpen(false)} />
    </View>
  );
}
