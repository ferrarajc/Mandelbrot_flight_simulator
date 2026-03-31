import React, { useCallback, useRef } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { makeProgram } from '../gl/makeProgram';
import { MANDELBROT_FRAG } from '../gl/shaders';
import { useApp } from '../context/AppContext';
import {
  BOUND, MAX_ZOOM, MIN_ZOOM,
  LONG_PRESS_MS, LONG_PRESS_MOVE, ZOOM_RATE,
} from '../constants';

const TAP_MAX_MOVE = 12;
const TAP_MAX_MS   = 500;

type Props = { onTap: () => void; onReady: () => void };

export default function MandelbrotOnly({ onTap, onReady }: Props) {
  const { width, height } = useWindowDimensions();
  const { cx, cy, mandZoom, uPhase, uFreq, autopilotPanLocked } = useApp();

  const g = useRef({
    t0: 0, startX: 0, startY: 0, startCX: 0, startCY: 0,
    maxMove: 0, multiTouch: false,
    lpActive: false, lpTimer: null as ReturnType<typeof setTimeout> | null, lpRaf: 0,
    pinchActive: false, pinchDist0: 1, pinchZoom0: 1,
    lastMultiTouchEndMs: 0,
  }).current;

  const cancelLP = () => {
    if (g.lpTimer) { clearTimeout(g.lpTimer); g.lpTimer = null; }
    cancelAnimationFrame(g.lpRaf);
    g.lpActive = false;
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,

    onPanResponderGrant: (evt) => {
      const t = evt.nativeEvent.touches;
      g.t0 = Date.now();
      g.startX = t[0]?.pageX ?? 0; g.startY = t[0]?.pageY ?? 0;
      g.startCX = cx.current; g.startCY = cy.current;
      g.maxMove = 0; g.multiTouch = t.length >= 2;
      g.lpActive = false; g.pinchActive = false;
      g.lpTimer = setTimeout(() => {
        if (g.maxMove <= LONG_PRESS_MOVE && !g.multiTouch) {
          g.lpActive = true;
          const tick = () => {
            mandZoom.current = Math.min(MAX_ZOOM, mandZoom.current * ZOOM_RATE);
            g.lpRaf = requestAnimationFrame(tick);
          };
          g.lpRaf = requestAnimationFrame(tick);
        }
      }, LONG_PRESS_MS);
    },

    onPanResponderMove: (evt) => {
      const ts = evt.nativeEvent.touches;
      if (ts.length >= 2) g.multiTouch = true;
      const dx = ts[0].pageX - g.startX;
      const dy = ts[0].pageY - g.startY;
      g.maxMove = Math.max(g.maxMove, Math.hypot(dx, dy));
      if (g.maxMove > LONG_PRESS_MOVE) cancelLP();
      if (g.lpActive) return;
      if (ts.length >= 2) {
        const dist = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        if (!g.pinchActive) { g.pinchActive = true; g.pinchDist0 = dist; g.pinchZoom0 = mandZoom.current; }
        mandZoom.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, g.pinchZoom0 * (dist / g.pinchDist0)));
      } else if (ts.length === 1 && g.maxMove > TAP_MAX_MOVE && !g.pinchActive && !autopilotPanLocked.current) {
        const scale = mandZoom.current * height * 0.5;
        cx.current = Math.max(-BOUND, Math.min(BOUND, g.startCX - dx / scale));
        cy.current = Math.max(-BOUND, Math.min(BOUND, g.startCY + dy / scale));
      }
    },

    onPanResponderRelease: () => {
      const elapsed = Date.now() - g.t0;
      const wasMulti = g.multiTouch;
      const wasTap = g.maxMove < TAP_MAX_MOVE && elapsed < TAP_MAX_MS
                  && !g.multiTouch && !g.lpActive
                  && Date.now() - g.lastMultiTouchEndMs > 200;
      cancelLP(); g.pinchActive = false; g.multiTouch = false;
      if (wasMulti) g.lastMultiTouchEndMs = Date.now();
      if (wasTap) onTap();
    },

    onPanResponderTerminate: () => { cancelLP(); g.pinchActive = false; },
  })).current;

  const onMandelbrot = useCallback((gl: ExpoWebGLRenderingContext) => {
    let signalled = false;
    const prog    = makeProgram(gl, MANDELBROT_FRAG);
    const uRes    = gl.getUniformLocation(prog, 'u_res');
    const uCenter = gl.getUniformLocation(prog, 'u_center');
    const uZoom   = gl.getUniformLocation(prog, 'u_zoom');
    const uPhaseL = gl.getUniformLocation(prog, 'u_phase');
    const uFreqL  = gl.getUniformLocation(prog, 'u_freq');
    let raf = 0;
    const draw = () => {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uCenter, cx.current, cy.current);
      gl.uniform1f(uZoom, mandZoom.current);
      gl.uniform3fv(uPhaseL, uPhase.current);
      gl.uniform1f(uFreqL,  uFreq.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.endFrameEXP();
      if (!signalled) { signalled = true; onReady(); }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const hw = width  / 2;
  const hh = height / 2;

  return (
    <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onMandelbrot} />
      {/* Crosshair marks the Julia c-parameter point */}
      <View style={[styles.armL, { top: hh - 0.5, left: hw - 30 }]} />
      <View style={[styles.armR, { top: hh - 0.5, left: hw +  8 }]} />
      <View style={[styles.armU, { top: hh - 30,  left: hw - 0.5 }]} />
      <View style={[styles.armD, { top: hh +  8,  left: hw - 0.5 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  armL: { position: 'absolute', width: 22, height: 1,  backgroundColor: '#ffffff' },
  armR: { position: 'absolute', width: 22, height: 1,  backgroundColor: '#ffffff' },
  armU: { position: 'absolute', width: 1,  height: 22, backgroundColor: '#ffffff' },
  armD: { position: 'absolute', width: 1,  height: 22, backgroundColor: '#ffffff' },
});
