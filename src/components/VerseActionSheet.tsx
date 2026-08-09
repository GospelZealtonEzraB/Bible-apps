import React from 'react';
import { Modal, View, Text, Pressable, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore } from '@/store/useStore';
import { verseId, translationName as translationNameOf, type FetchedVerse } from '@/data/bibleApi';

/**
 * A bottom-sheet of actions for a single verse — the "from anywhere to
 * memorized" hub. Reused wherever a verse appears (reader today; search,
 * sermons, topics later). Memorize uses the text already in hand, so it works
 * offline with no refetch.
 */
export function VerseActionSheet({
  visible,
  onClose,
  reference,
  text,
  translation,
}: {
  visible: boolean;
  onClose: () => void;
  reference: string;
  text: string;
  translation: string;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const addFetchedVerse = useStore((s) => s.addFetchedVerse);
  const alreadySaved = useStore((s) => !!s.verses[verseId(reference, translation)]);

  const memorize = () => {
    if (!alreadySaved) {
      const fetched: FetchedVerse = {
        reference,
        text,
        translation,
        translationName: translationNameOf(translation),
        offline: false,
      };
      addFetchedVerse(fetched);
    }
    onClose();
    router.push(`/verse/${encodeURIComponent(verseId(reference, translation))}`);
  };

  const note = () => {
    if (!alreadySaved) {
      addFetchedVerse({ reference, text, translation, translationName: translationNameOf(translation), offline: false });
    }
    onClose();
    router.push(`/verse/${encodeURIComponent(verseId(reference, translation))}`);
  };

  const study = () => {
    onClose();
    router.push(`/study/${encodeURIComponent(reference)}`);
  };

  const share = async () => {
    onClose();
    try {
      await Share.share({ message: `"${text}"\n— ${reference}` });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.lg,
            paddingBottom: spacing.xxl,
            gap: spacing.xs,
          }}
          onPress={() => {}}
        >
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.lg }}>{reference}</Text>
          <Text
            numberOfLines={2}
            style={{ color: colors.textMuted, fontSize: font.sizes.sm, fontFamily: font.serif, marginBottom: spacing.sm }}
          >
            {text}
          </Text>

          <ActionRow
            icon="sparkles-outline"
            label={alreadySaved ? 'Open in your library' : 'Memorize this verse'}
            hint={alreadySaved ? 'Already saved' : 'Hide it in your heart'}
            color={colors.primary}
            onPress={memorize}
          />
          <ActionRow icon="create-outline" label="Add a note" hint="Record what you're seeing" color={colors.success} onPress={note} />
          <ActionRow icon="book-outline" label="Study this passage" hint="Setting, people, cross-refs" color={colors.accent} onPress={study} />
          <ActionRow icon="share-outline" label="Share" hint="Send to a friend" color={colors.textMuted} onPress={share} />

          <Pressable onPress={onClose} style={{ paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs }}>
            <Text style={{ color: colors.textFaint, fontWeight: '700', fontSize: font.sizes.md }}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  color: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
      })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>{label}</Text>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}
