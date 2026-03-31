import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ColorScheme,
  DISC_T_EDGE,
  DISC_T_OUTSIDE,
  ViewMode,
  evalPalette,
} from '../constants';

type Props = {
  open: boolean;
  cx: number;
  cy: number;
  viewMode: ViewMode;
  colorScheme: ColorScheme;
  autopilotOn: boolean;
  onOpenViewMenu: () => void;
  onOpenColorMenu: () => void;
  onOpenAutopilot: () => void;
  onEditCoords: () => void;
  onOpenHelp: () => void;
};

function fmt(v: number): string {
  const sign = v < 0 ? '-' : ' ';
  return sign + Math.abs(v).toFixed(8);
}

function ColorDisc({ scheme }: { scheme: ColorScheme }) {
  const outside = evalPalette(DISC_T_OUTSIDE, scheme);
  const edge    = evalPalette(DISC_T_EDGE,    scheme);
  return (
    <View style={[disc.circle, { backgroundColor: edge }]}>
      <View style={[disc.tri, { borderTopColor: outside }]} />
    </View>
  );
}

const DISC_SIZE = 32;
const disc = StyleSheet.create({
  circle: { width: DISC_SIZE, height: DISC_SIZE, borderRadius: DISC_SIZE / 2, overflow: 'hidden' },
  tri: {
    position: 'absolute', top: 0, left: 0,
    width: 0, height: 0,
    borderStyle: 'solid',
    borderTopWidth: DISC_SIZE, borderRightWidth: DISC_SIZE,
    borderRightColor: 'transparent',
  },
});

// Start far off-screen so it's never visible before we know the real height.
const INITIAL_OFFSET = 400;

export default function Drawer({
  open, cx, cy, colorScheme, autopilotOn,
  onOpenViewMenu, onOpenColorMenu, onOpenAutopilot, onEditCoords, onOpenHelp,
}: Props) {
  const insets   = useSafeAreaInsets();
  const anim     = useRef(new Animated.Value(INITIAL_OFFSET)).current;
  const heightRef = useRef(INITIAL_OFFSET);

  // Measure the true rendered height so we know exactly how far to translate it off-screen.
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) heightRef.current = h;
    // If currently closed, snap to the new (measured) position immediately.
    if (!open) anim.setValue(h);
  }, [open]);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: open ? 0 : heightRef.current,
      useNativeDriver: true,
      speed: 22,
      bounciness: 0,
    }).start();
  }, [open]);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.drawer,
        { paddingBottom: insets.bottom + 8 },
        { transform: [{ translateY: anim }] },
      ]}
      // box-none: drawer container itself doesn't block touches, but its children do.
      pointerEvents="box-none"
    >
      {/* Coordinates — tap to edit */}
      <Pressable style={styles.coords} onPress={onEditCoords} hitSlop={8}>
        <Text style={styles.coord}>{`Cr ${fmt(cx)}`}</Text>
        <Text style={styles.coord}>{`Ci ${fmt(cy)}`}</Text>
      </Pressable>

      {/* Buttons */}
      <View style={styles.buttons}>
        <Pressable style={styles.btn} onPress={onOpenViewMenu} hitSlop={8}>
          <Ionicons name="eye-outline" size={26} color="#fff" />
        </Pressable>

        <Pressable style={styles.btn} onPress={onOpenColorMenu} hitSlop={8}>
          <ColorDisc scheme={colorScheme} />
        </Pressable>

        <Pressable
          style={[styles.btn, autopilotOn && styles.btnActive]}
          onPress={onOpenAutopilot}
          hitSlop={8}
        >
          <Ionicons
            name="airplane-outline"
            size={26}
            color={autopilotOn ? '#000' : '#fff'}
          />
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable style={styles.btn} onPress={onOpenHelp} hitSlop={8}>
          <Ionicons name="help-circle-outline" size={26} color="#fff" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(18,18,18,0.97)',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  coords: { marginBottom: 12 },
  coord: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 13,
    letterSpacing: 0.5,
    lineHeight: 20,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  btn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  btnActive: { backgroundColor: '#fff' },
});
