import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme, spacing, font, radius } from '@/theme';
import { useCircle, useStore } from '@/store/useStore';

const EMOJIS = ['🙏', '💡', '❤️'];

/**
 * A lightweight reaction row (amen 🙏 / 💡 / ❤️) for a prayer, note, or message.
 * Reads reactions from the cached circle snapshot and toggles via the optimistic
 * `reactTo` store action. Server-gated (API v8); renders quietly with no bar if
 * reactions aren't available yet.
 */
export function ReactionBar({ code, targetType, targetId }: { code: string; targetType: 'prayer' | 'note' | 'message'; targetId: string }) {
  const { colors } = useTheme();
  const circle = useCircle(code);
  const myId = useStore((s) => s.profile.memberId);
  const reactTo = useStore((s) => s.reactTo);

  const list = circle?.reactions?.[`${targetType}:${targetId}`] ?? [];
  const mine = list.find((r) => r.by === myId)?.emoji;
  const countOf = (e: string) => list.filter((r) => r.emoji === e).length;

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
      {EMOJIS.map((e) => {
        const n = countOf(e);
        const active = mine === e;
        return (
          <Pressable
            key={e}
            onPress={() => reactTo(code, targetType, targetId, e).catch(() => {})}
            hitSlop={6}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: active ? colors.primarySoft : colors.surfaceAlt, borderWidth: 1, borderColor: active ? colors.primary : 'transparent' }}
          >
            <Text style={{ fontSize: 14 }}>{e}</Text>
            {n > 0 ? <Text style={{ color: active ? colors.primary : colors.textMuted, fontSize: font.sizes.xs, fontWeight: '800' }}>{n}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
