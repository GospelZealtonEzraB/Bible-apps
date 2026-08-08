import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, {
  Path,
  Circle,
  Ellipse,
  G,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

export type EmberMood =
  | 'content'
  | 'celebrating'
  | 'proud'
  | 'worried'
  | 'sleeping'
  | 'excited'
  | 'thinking';

const FLAME_3 = '#E0592B';
const FLAME_2 = '#F5A623';
const FLAME_1 = '#FFD36B';
const FLAME_INNER = '#FFEBB0';
const CHEEK = '#FF8FA3';
const EYE = '#2A1A0A';
const ACCENT = '#F5B454';
const TEAR = '#7FD7FF';

/**
 * Ember — the app's flame mascot. Renders one of several emotional states.
 * Purely presentational; drive `mood` from streak/progress state.
 */
export function Ember({
  mood = 'content',
  size = 96,
  animated = true,
}: {
  mood?: EmberMood;
  size?: number;
  animated?: boolean;
}) {
  const width = size * (200 / 240);
  const bob = useRef(new Animated.Value(0)).current;
  const excited = mood === 'celebrating' || mood === 'excited';

  useEffect(() => {
    if (!animated) return;
    bob.setValue(0);
    const dur = excited ? 600 : 2200;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, excited, bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, excited ? -9 : -4] });
  const scale = bob.interpolate({ inputRange: [0, 1], outputRange: [1, excited ? 1.05 : 1.015] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['0deg', excited ? '3deg' : '1deg'] });

  return (
    <Animated.View style={{ width, height: size, transform: [{ translateY }, { scale }, { rotate }] }}>
      <Svg width={width} height={size} viewBox="0 0 200 240">
        <Defs>
          <LinearGradient id="flameBody" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={FLAME_2} />
            <Stop offset="1" stopColor={FLAME_3} />
          </LinearGradient>
        </Defs>

        {/* Body */}
        <Path
          d="M100 18 C76 62 50 82 50 128 C50 174 74 212 100 212 C126 212 150 174 150 128 C150 92 128 74 118 48 C112 34 108 24 100 18 Z"
          fill="url(#flameBody)"
        />
        <Path
          d="M100 78 C88 102 78 114 78 138 C78 166 88 188 100 188 C112 188 122 166 122 138 C122 118 112 106 108 92 C105 84 103 82 100 78 Z"
          fill={FLAME_1}
        />
        <Path
          d="M100 116 C94 128 90 136 90 150 C90 166 95 178 100 178 C105 178 110 166 110 150 C110 140 106 132 104 124 C102 120 101 118 100 116 Z"
          fill={FLAME_INNER}
        />
        {/* Arms */}
        <Ellipse cx="52" cy="150" rx="10" ry="7" fill={FLAME_3} />
        <Ellipse cx="148" cy="150" rx="10" ry="7" fill={FLAME_3} />
        {/* Cheeks */}
        <Ellipse cx="76" cy="146" rx="7" ry="4.5" fill={CHEEK} opacity={0.5} />
        <Ellipse cx="124" cy="146" rx="7" ry="4.5" fill={CHEEK} opacity={0.5} />

        <Face mood={mood} />
      </Svg>
    </Animated.View>
  );
}

function Face({ mood }: { mood: EmberMood }) {
  switch (mood) {
    case 'celebrating':
      return (
        <G>
          <Path d="M80 133 Q86 124 92 133" stroke={EYE} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M108 133 Q114 124 120 133" stroke={EYE} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Ellipse cx="100" cy="150" rx="8" ry="9" fill={EYE} />
          <Path d="M46 96 l2.4 6 6 2.4 -6 2.4 -2.4 6 -2.4 -6 -6 -2.4 6 -2.4 z" fill={ACCENT} />
          <Path d="M156 104 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill={ACCENT} />
        </G>
      );
    case 'proud':
      return (
        <G>
          {/* wink */}
          <Path d="M80 132 Q86 138 92 132" stroke={EYE} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Circle cx="114" cy="132" r="5.5" fill={EYE} />
          <Path d="M89 148 Q100 158 111 148" stroke={EYE} strokeWidth={3} strokeLinecap="round" fill="none" />
        </G>
      );
    case 'worried':
      return (
        <G>
          <Path d="M78 126 L94 130" stroke={EYE} strokeWidth={3} strokeLinecap="round" />
          <Path d="M122 126 L106 130" stroke={EYE} strokeWidth={3} strokeLinecap="round" />
          <Circle cx="87" cy="134" r="4.5" fill={EYE} />
          <Circle cx="113" cy="134" r="4.5" fill={EYE} />
          <Path d="M90 152 Q100 145 110 152" stroke={EYE} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M140 120 q6 10 0 16 q-6 -6 0 -16z" fill={TEAR} />
        </G>
      );
    case 'sleeping':
      return (
        <G>
          <Path d="M80 132 Q86 138 92 132" stroke={EYE} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M108 132 Q114 138 120 132" stroke={EYE} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Circle cx="100" cy="150" r="4" fill={EYE} />
          <SvgText x="132" y="88" fontSize="20" fill={EYE} opacity={0.5}>z</SvgText>
          <SvgText x="148" y="74" fontSize="26" fill={EYE} opacity={0.5}>Z</SvgText>
        </G>
      );
    case 'excited':
      return (
        <G>
          {/* wide sparkly eyes + big open smile */}
          <Circle cx="86" cy="131" r="6.5" fill={EYE} />
          <Circle cx="114" cy="131" r="6.5" fill={EYE} />
          <Circle cx="88.5" cy="128.5" r="2" fill="#fff" />
          <Circle cx="116.5" cy="128.5" r="2" fill="#fff" />
          <Path d="M87 147 Q100 162 113 147 Q100 154 87 147 Z" fill={EYE} />
          <Path d="M44 92 l2.6 6.6 6.6 2.6 -6.6 2.6 -2.6 6.6 -2.6 -6.6 -6.6 -2.6 6.6 -2.6 z" fill={ACCENT} />
          <Path d="M158 100 l2.2 5.4 5.4 2.2 -5.4 2.2 -2.2 5.4 -2.2 -5.4 -5.4 -2.2 5.4 -2.2 z" fill={ACCENT} />
        </G>
      );
    case 'thinking':
      return (
        <G>
          {/* eyes glancing up, small mouth, thought dots */}
          <Circle cx="87" cy="129" r="5.5" fill={EYE} />
          <Circle cx="115" cy="129" r="5.5" fill={EYE} />
          <Path d="M92 150 L108 150" stroke={EYE} strokeWidth={3} strokeLinecap="round" />
          <Circle cx="140" cy="118" r="2.6" fill={EYE} opacity={0.55} />
          <Circle cx="150" cy="108" r="3.4" fill={EYE} opacity={0.55} />
          <Circle cx="162" cy="96" r="4.4" fill={EYE} opacity={0.55} />
        </G>
      );
    case 'content':
    default:
      return (
        <G>
          <Circle cx="86" cy="132" r="5.5" fill={EYE} />
          <Circle cx="114" cy="132" r="5.5" fill={EYE} />
          <Path d="M90 148 Q100 156 110 148" stroke={EYE} strokeWidth={3} strokeLinecap="round" fill="none" />
        </G>
      );
  }
}
