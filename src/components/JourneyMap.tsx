import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, useWindowDimensions, LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme, spacing, font } from '@/theme';
import { Ember } from '@/components/Ember';
import { masteryTier } from '@/gamification';
import type { Verse } from '@/types';

const ROW = 96;
const TOP_PAD = 104;
const BOTTOM_PAD = 32;
const R = 27;

function tierColor(mastery: number, colors: ReturnType<typeof useTheme>['colors']): string {
  switch (masteryTier(mastery).key) {
    case 'gold':
      return colors.accent;
    case 'silver':
      return colors.textFaint;
    case 'bronze':
      return colors.warning;
    default:
      return colors.surfaceAlt;
  }
}

/**
 * A winding "journey" of the user's verses — nodes climb a path, colored by
 * mastery tier, with Ember cheering from the top. Tap a node to open the verse.
 * Renders at a fixed height inside the parent scroll view.
 */
export function JourneyMap({
  verses,
  onSelect,
}: {
  verses: Verse[];
  onSelect: (id: string) => void;
}) {
  const { colors } = useTheme();
  const win = useWindowDimensions();
  const [measured, setMeasured] = useState(0);

  const width = measured || win.width - spacing.lg * 2;
  const center = width / 2;
  const amplitude = Math.max(0, center - R - 6);

  const nodes = useMemo(
    () =>
      verses.map((v, i) => ({
        v,
        x: center + Math.sin(i * 0.8) * amplitude,
        y: TOP_PAD + i * ROW,
      })),
    [verses, center, amplitude],
  );

  const totalHeight = TOP_PAD + Math.max(0, verses.length - 1) * ROW + BOTTOM_PAD + R;

  // The first not-yet-memorized verse is the "current" step.
  const currentIdx = verses.findIndex((v) => v.status !== 'memorized');

  const pathD = nodes
    .map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`)
    .join(' ');

  const onLayout = (e: LayoutChangeEvent) => setMeasured(e.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout} style={{ height: totalHeight, width: '100%' }}>
      {/* Ember at the summit */}
      <View style={{ position: 'absolute', top: 0, left: center - 40, alignItems: 'center', width: 80 }}>
        <Ember mood="proud" size={72} />
      </View>

      {/* Connector path */}
      {nodes.length > 1 ? (
        <Svg width={width} height={totalHeight} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Path
            d={pathD}
            stroke={colors.border}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray="2 14"
            fill="none"
          />
        </Svg>
      ) : null}

      {/* Nodes */}
      {nodes.map((n, i) => {
        const color = tierColor(n.v.mastery, colors);
        const isCurrent = i === currentIdx;
        return (
          <Pressable
            key={n.v.id}
            onPress={() => onSelect(n.v.id)}
            style={{
              position: 'absolute',
              left: n.x - R,
              top: n.y - R,
              width: R * 2,
              height: R * 2,
              borderRadius: R,
              backgroundColor: color,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: isCurrent ? 3 : 1,
              borderColor: isCurrent ? colors.primary : colors.border,
            }}
          >
            <Text style={{ fontSize: 22 }}>{masteryTier(n.v.mastery).emoji}</Text>
            <View
              style={{
                position: 'absolute',
                top: R * 2 + 2,
                width: 120,
                left: R - 60,
              }}
              pointerEvents="none"
            >
              <Text
                numberOfLines={1}
                style={{
                  color: colors.textMuted,
                  fontSize: font.sizes.xs,
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              >
                {n.v.reference}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
