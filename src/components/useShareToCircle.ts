import { Alert } from 'react-native';
import { useStore } from '@/store/useStore';

/**
 * Share a verse note into a circle. If the user is in one circle it shares
 * directly; with several, it prompts which one. Reads circles at call time to
 * avoid returning a new selector object each render.
 */
export function useShareToCircle() {
  const count = useStore((s) => Object.keys(s.circles).length);
  const shareNote = useStore((s) => s.shareNote);

  const share = (text: string, reference: string) => {
    const t = text.trim();
    if (!t) return;
    const circles = Object.entries(useStore.getState().circles);
    if (circles.length === 0) return;
    if (circles.length === 1) {
      void shareNote(circles[0][0], t, 'verse', reference);
      return;
    }
    Alert.alert('Share to which circle?', undefined, [
      ...circles.slice(0, 4).map(([code, c]) => ({
        text: c.meta?.name || code,
        onPress: () => void shareNote(code, t, 'verse', reference),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return { canShare: count > 0, share };
}
