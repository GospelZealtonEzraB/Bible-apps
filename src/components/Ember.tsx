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
  | 'thinking'
  | 'waving'
  | 'praying'
  | 'reading'
  | 'love';

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
  react = 0,
}: {
  mood?: EmberMood;
  size?: number;
  animated?: boolean;
  /** Bump this number to trigger a one-shot "pop" bounce (e.g. on a win). */
  react?: number;
}) {
  const width = size * (200 / 240);
  const bob = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
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

  // One-shot pop: quick over-scale then settle. Skips the initial mount (react=0).
  useEffect(() => {
    if (!react) return;
    pop.setValue(0);
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 18 }),
      Animated.timing(pop, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [react, pop]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, excited ? -9 : -4] });
  const bobScale = bob.interpolate({ inputRange: [0, 1], outputRange: [1, excited ? 1.05 : 1.015] });
  const popScale = pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const scale = Animated.multiply(bobScale, popScale);
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
    case 'waving':
      return (
        <G>
          {/* bright open eyes + big friendly smile + a raised hand */}
          <Circle cx="86" cy="132" r="5.5" fill={EYE} />
          <Circle cx="114" cy="132" r="5.5" fill={EYE} />
          <Path d="M87 147 Q100 160 113 147 Q100 154 87 147 Z" fill={EYE} />
          <Ellipse cx="160" cy="120" rx="9" ry="6.5" fill={FLAME_3} />
          <Path d="M154 112 q6 -6 12 0" stroke={FLAME_3} strokeWidth={3} strokeLinecap="round" fill="none" />
        </G>
      );
    case 'praying':
      return (
        <G>
          {/* serene closed eyes + gentle smile + a small halo sparkle */}
          <Path d="M80 133 Q86 139 92 133" stroke={EYE} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M108 133 Q114 139 120 133" stroke={EYE} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M92 150 Q100 155 108 150" stroke={EYE} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M100 30 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" fill={ACCENT} opacity={0.9} />
        </G>
      );
    case 'reading':
      return (
        <G>
          {/* eyes cast down, focused; small neutral mouth */}
          <Path d="M81 130 q5 5 10 0" stroke={EYE} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M109 130 q5 5 10 0" stroke={EYE} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Circle cx="86" cy="135" r="3.6" fill={EYE} />
          <Circle cx="114" cy="135" r="3.6" fill={EYE} />
          <Path d="M93 151 L107 151" stroke={EYE} strokeWidth={3} strokeLinecap="round" />
        </G>
      );
    case 'love':
      return (
        <G>
          {/* heart eyes + happy smile */}
          <Path d="M86 128 c-3 -3 -8 -1 -8 3 c0 4 6 7 8 9 c2 -2 8 -5 8 -9 c0 -4 -5 -6 -8 -3 z" fill={CHEEK} />
          <Path d="M114 128 c-3 -3 -8 -1 -8 3 c0 4 6 7 8 9 c2 -2 8 -5 8 -9 c0 -4 -5 -6 -8 -3 z" fill={CHEEK} />
          <Path d="M89 150 Q100 159 111 150" stroke={EYE} strokeWidth={3} strokeLinecap="round" fill="none" />
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
