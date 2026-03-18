import React from 'react';
import { StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import {
  Canvas,
  Rect,
  Shader,
  Skia,
  Line,
  Circle,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  clamp,
  withDecay,
} from 'react-native-reanimated';
import { MANDELBROT_SHADER } from './src/shaders/mandelbrot';
import { JULIA_SHADER } from './src/shaders/julia';

// Constants
const PIP_SIZE = 200;
const PIP_MARGIN = 16;
const MAX_ZOOM = 500;
const MIN_ZOOM = 0.4;
const JULIA_ZOOM = 1.5;
const CENTER_BOUND = 2.0;

// Create Skia RuntimeEffects once, outside the component
const mandelbrotEffect = Skia.RuntimeEffect.Make(MANDELBROT_SHADER)!;
const juliaEffect = Skia.RuntimeEffect.Make(JULIA_SHADER)!;
if (!mandelbrotEffect || !juliaEffect) {
  throw new Error('Failed to compile shader(s) — check SkSL syntax');
}

export default function App() {
  const { width, height } = useWindowDimensions();

  // Shared values for view state
  const centerX = useSharedValue(0);
  const centerY = useSharedValue(0);
  const zoom = useSharedValue(1);

  // Saved values captured at gesture start
  const savedCenterX = useSharedValue(0);
  const savedCenterY = useSharedValue(0);
  const savedZoom = useSharedValue(1);

  // Pan gesture: drag to move the Mandelbrot view center
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      savedCenterX.value = centerX.value;
      savedCenterY.value = centerY.value;
    })
    .onUpdate((event) => {
      'worklet';
      const scale = zoom.value * height * 0.5;
      // Negative because dragging right moves view left (center moves opposite)
      const newX = savedCenterX.value - event.translationX / scale;
      const newY = savedCenterY.value - event.translationY / scale;
      centerX.value = clamp(newX, -CENTER_BOUND, CENTER_BOUND);
      centerY.value = clamp(newY, -CENTER_BOUND, CENTER_BOUND);
    })
    .onEnd((event) => {
      'worklet';
      const scale = zoom.value * height * 0.5;
      centerX.value = withDecay({
        velocity: -event.velocityX / scale,
        clamp: [-CENTER_BOUND, CENTER_BOUND],
      });
      centerY.value = withDecay({
        velocity: -event.velocityY / scale,
        clamp: [-CENTER_BOUND, CENTER_BOUND],
      });
    });

  // Pinch gesture: zoom in/out
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      savedZoom.value = zoom.value;
    })
    .onUpdate((event) => {
      'worklet';
      zoom.value = clamp(savedZoom.value * event.scale, MIN_ZOOM, MAX_ZOOM);
    });

  // Compose gestures to run simultaneously
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  // Mandelbrot shader uniforms (runs on UI thread via Reanimated)
  const mandelbrotUniforms = useDerivedValue(() => ({
    resolution: [width, height],
    center: [centerX.value, centerY.value],
    zoom: zoom.value,
  }));

  // Julia shader uniforms
  const juliaUniforms = useDerivedValue(() => ({
    resolution: [PIP_SIZE, PIP_SIZE],
    c: [centerX.value, centerY.value],
    zoom: JULIA_ZOOM,
  }));

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <GestureDetector gesture={composedGesture}>
        <View style={styles.container}>
          {/* Main Mandelbrot Canvas */}
          <Canvas style={StyleSheet.absoluteFill}>
            <Rect x={0} y={0} width={width} height={height}>
              <Shader source={mandelbrotEffect} uniforms={mandelbrotUniforms} />
            </Rect>
            {/* Crosshair overlay */}
            <Line
              p1={{ x: width / 2 - 30, y: height / 2 }}
              p2={{ x: width / 2 + 30, y: height / 2 }}
              color="rgba(255,255,255,0.8)"
              strokeWidth={1}
            />
            <Line
              p1={{ x: width / 2, y: height / 2 - 30 }}
              p2={{ x: width / 2, y: height / 2 + 30 }}
              color="rgba(255,255,255,0.8)"
              strokeWidth={1}
            />
            <Circle
              cx={width / 2}
              cy={height / 2}
              r={2}
              color="rgba(255,255,255,0.9)"
            />
          </Canvas>

          {/* Julia Set Picture-in-Picture */}
          <Canvas
            style={[
              styles.pip,
              {
                right: PIP_MARGIN,
                bottom: PIP_MARGIN,
                width: PIP_SIZE,
                height: PIP_SIZE,
              },
            ]}
          >
            <Rect x={0} y={0} width={PIP_SIZE} height={PIP_SIZE}>
              <Shader source={juliaEffect} uniforms={juliaUniforms} />
            </Rect>
          </Canvas>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  pip: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
});
