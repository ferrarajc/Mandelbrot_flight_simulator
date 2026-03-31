import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DELAY_MS = 5 * 1000;
const FADE_MS  = 600;

type Props = { active: boolean };

export default function HintBanner({ active }: Props) {
  const insets  = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const delayT  = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!active) {
      clearTimeout(delayT.current);
      opacity.stopAnimation();
      opacity.setValue(0);
      return;
    }

    delayT.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 1, duration: FADE_MS, useNativeDriver: true,
      }).start();
    }, DELAY_MS);

    return () => clearTimeout(delayT.current);
  }, [active]);

  return (
    <Animated.View
      style={[styles.banner, { bottom: insets.bottom + 32, opacity }]}
      pointerEvents="none"
    >
      <Text style={styles.text}>Tap anywhere to open the menu</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 32,
    right: 32,
    alignItems: 'center',
  },
  text: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
