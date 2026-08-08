import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/theme';

interface Props {
  /** 0..100 */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

/** A circular progress ring with an optional centered label. */
export function ProgressRing({
  progress,
  size = 72,
  stroke = 7,
  color,
  trackColor,
  label,
  sublabel,
}: Props) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, progress));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const ringColor = color ?? colors.primary;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor ?? colors.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={ringColor}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {(label || sublabel) && (
        <View style={styles.center} pointerEvents="none">
          {label ? (
            <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
          ) : null}
          {sublabel ? (
            <Text style={[styles.sublabel, { color: colors.textFaint }]}>
              {sublabel}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '700' },
  sublabel: { fontSize: 10, marginTop: 1 },
});
