import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, spacing, font, radius } from '@/theme';
import { useStore, useLog } from '@/store/useStore';
import { isLogged } from '@/utils/log';
import { dayKey } from '@/utils/date';
import type { LogKind, MessageAttachment } from '@/types';

export interface Asset {
  kind: LogKind;
  /** Scripture reference, for verse/passage assets. */
  ref?: string;
  /** Note / song / teaching / topic id. */
  assetId?: string;
  title: string;
  /** Body text to carry into a chat message (a note's preview, a verse's words). */
  text?: string;
}

/**
 * The one row of actions that appears under every asset in the app — a verse, a
 * chapter, a note, a song, a teaching, a topic.
 *
 * **Add to my log** records it against today (idempotent — a second tap does
 * nothing). **Share** carries it into the chat so you can talk about it with
 * your partner. Keeping this one component everywhere is what makes the app
 * feel like a single thing rather than a pile of screens.
 */
export function AssetActions({ asset, compact = false }: { asset: Asset; compact?: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const log = useLog();
  const addLogEntry = useStore((s) => s.addLogEntry);
  const setPendingChatAttachment = useStore((s) => s.setPendingChatAttachment);
  const hasPartner = useStore((s) => Object.keys(s.circles).length > 0);

  const today = dayKey();
  const logged = isLogged(log, today, asset.kind, asset.assetId ?? asset.ref);

  const addToLog = () => {
    if (logged) return;
    addLogEntry({
      kind: asset.kind,
      ref: asset.ref,
      assetId: asset.assetId,
      title: asset.title,
    });
  };

  const shareToChat = () => {
    const attachment: MessageAttachment = {
      kind: attachmentKind(asset.kind),
      title: asset.title,
      ref: asset.ref,
      text: asset.text,
    };
    setPendingChatAttachment(attachment);
    router.push('/chat');
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      <Action
        icon={logged ? 'checkmark-circle' : 'add-circle-outline'}
        label={logged ? 'In today’s log' : 'Add to my log'}
        color={logged ? colors.success : colors.primary}
        active={logged}
        compact={compact}
        onPress={addToLog}
      />
      {hasPartner ? (
        <Action
          icon="chatbubble-ellipses-outline"
          label="Share"
          color={colors.primary}
          compact={compact}
          onPress={shareToChat}
        />
      ) : null}
    </View>
  );
}

/** Map a log kind onto the chat's attachment kinds. */
function attachmentKind(kind: LogKind): MessageAttachment['kind'] {
  switch (kind) {
    case 'verse':
    case 'passage':
      return 'verse';
    case 'song':
      return 'song';
    case 'note':
    case 'teaching':
    case 'topic':
    default:
      return 'note';
  }
}

function Action({
  icon,
  label,
  color,
  active,
  compact,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  active?: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: compact ? 5 : 8,
        paddingHorizontal: compact ? spacing.sm : spacing.md,
        borderRadius: radius.pill,
        backgroundColor: pressed ? colors.border : active ? colors.surfaceAlt : colors.surfaceAlt,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={compact ? 13 : 15} color={color} />
      <Text style={{ color, fontWeight: '700', fontSize: compact ? font.sizes.xs : font.sizes.sm }}>
        {label}
      </Text>
    </Pressable>
  );
}
