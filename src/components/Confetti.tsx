import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, useWindowDimensions } from 'react-native';

const COLORS = ['#F5B454', '#7C9CF5', '#5FD0A0', '#F58C8C', '#F5C97C', '#FFD36B'];

/** A one-shot confetti burst that rains down and fades out. Non-interactive. */
export function Confetti({
  count = 26,
  duration = 1700,
}: {
  count?: number;
  duration?: number;
}) {
  const { width, height } = useWindowDimensions();
  const pieces = useRef(
    Array.from({ length: count }, (_, i) => ({
      x: Math.random() * width,
      delay: Math.random() * 250,
      size: 6 + Math.random() * 8,
      color: COLORS[i % COLORS.length],
      spin: Math.random() * 360,
      drift: (Math.random() - 0.5) * 90,
      anim: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    Animated.stagger(
      18,
      pieces.map((p) =>
        Animated.timing(p.anim, {
          toValue: 1,
          duration,
          delay: p.delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [pieces, duration]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {pieces.map((p, i) => {
        const translateY = p.anim.interpolate({ inputRange: [0, 1], outputRange: [-30, height * 0.9] });
        const translateX = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
        const rotate = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.spin + 360}deg`],
        });
        const opacity = p.anim.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: 0,
              width: p.size,
              height: p.size * 0.6,
              borderRadius: 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}
