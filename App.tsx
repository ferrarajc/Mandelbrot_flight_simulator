import React, { useCallback, useRef, useState } from 'react';
import {
  PanResponder,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Canvas, Circle, Line, Rect, Shader, Skia } from '@shopify/react-native-skia';
import { MANDELBROT_SHADER } from './src/shaders/mandelbrot';
import { JULIA_SHADER } from './src/shaders/julia';

const PIP_SIZE = 200;
const PIP_MARGIN = 16;
const MAX_ZOOM = 500;
const MIN_ZOOM = 0.4;
const JULIA_ZOOM = 1.5;
const BOUND = 2.0;

const mandelbrotEffect = Skia.RuntimeEffect.Make(MANDELBROT_SHADER)!;
const juliaEffect = Skia.RuntimeEffect.Make(JULIA_SHADER)!;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function App() {
  const { width, height } = useWindowDimensions();

  // Mutable refs for gesture math (no React render on every frame)
  const centerX = useRef(0);
  const centerY = useRef(0);
  const zoom = useRef(1);

  // Snapshot values at gesture start
  const gesture = useRef({
    startCX: 0, startCY: 0, startZoom: 1,
    startTX: 0, startTY: 0,
    pinchActive: false, pinchStartDist: 1, pinchStartZoom: 1,
  });

  // React state drives Skia re-renders
  const [cx, setCX] = useState(0);
  const [cy, setCY] = useState(0);
  const [z, setZ] = useState(1);

  const commitState = useCallback(() => {
    setCX(centerX.current);
    setCY(centerY.current);
    setZ(zoom.current);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const g = gesture.current;
        const t = evt.nativeEvent.touches;
        g.startCX = centerX.current;
        g.startCY = centerY.current;
        g.startZoom = zoom.current;
        g.startTX = t[0]?.pageX ?? 0;
        g.startTY = t[0]?.pageY ?? 0;
        g.pinchActive = false;
      },

      onPanResponderMove: (evt) => {
        const g = gesture.current;
        const { touches } = evt.nativeEvent;

        if (touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (!g.pinchActive) {
            g.pinchActive = true;
            g.pinchStartDist = dist;
            g.pinchStartZoom = zoom.current;
          } else {
            zoom.current = clamp(
              g.pinchStartZoom * (dist / g.pinchStartDist),
              MIN_ZOOM,
              MAX_ZOOM
            );
          }
        } else if (touches.length === 1 && !g.pinchActive) {
          const scale = zoom.current * height * 0.5;
          centerX.current = clamp(
            g.startCX - (touches[0].pageX - g.startTX) / scale,
            -BOUND, BOUND
          );
          centerY.current = clamp(
            g.startCY - (touches[0].pageY - g.startTY) / scale,
            -BOUND, BOUND
          );
        }

        setCX(centerX.current);
        setCY(centerY.current);
        setZ(zoom.current);
      },

      onPanResponderRelease: () => {
        gesture.current.pinchActive = false;
      },
    })
  ).current;

  const mandelbrotUniforms = {
    resolution: [width, height],
    center: [cx, cy],
    zoom: z,
  };

  const juliaUniforms = {
    resolution: [PIP_SIZE, PIP_SIZE],
    c: [cx, cy],
    zoom: JULIA_ZOOM,
  };

  const hw = width / 2;
  const hh = height / 2;

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      <StatusBar hidden />

      {/* Mandelbrot full-screen */}
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={width} height={height}>
          <Shader source={mandelbrotEffect} uniforms={mandelbrotUniforms} />
        </Rect>
        {/* Crosshair */}
        <Line
          p1={{ x: hw - 30, y: hh }}
          p2={{ x: hw + 30, y: hh }}
          color="rgba(255,255,255,0.85)"
          strokeWidth={1}
        />
        <Line
          p1={{ x: hw, y: hh - 30 }}
          p2={{ x: hw, y: hh + 30 }}
          color="rgba(255,255,255,0.85)"
          strokeWidth={1}
        />
        <Circle cx={hw} cy={hh} r={2} color="rgba(255,255,255,0.95)" />
      </Canvas>

      {/* Julia PiP */}
      <Canvas style={styles.pip}>
        <Rect x={0} y={0} width={PIP_SIZE} height={PIP_SIZE}>
          <Shader source={juliaEffect} uniforms={juliaUniforms} />
        </Rect>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'black',
  },
  pip: {
    position: 'absolute',
    right: PIP_MARGIN,
    bottom: PIP_MARGIN,
    width: PIP_SIZE,
    height: PIP_SIZE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
});
