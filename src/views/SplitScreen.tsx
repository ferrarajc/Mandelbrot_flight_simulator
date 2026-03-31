import React, { useCallback, useRef } from 'react';
import {
  PixelRatio,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { makeProgram } from '../gl/makeProgram';
import { MANDELBROT_FRAG, JULIA_FRAG } from '../gl/shaders';
import { useApp } from '../context/AppContext';
import {
  BOUND, MAX_ZOOM, MAX_JULIA_ZOOM, MIN_JULIA_ZOOM, MIN_ZOOM, JULIA_ZOOM,
  LONG_PRESS_MS, LONG_PRESS_MOVE, ZOOM_RATE,
} from '../constants';

const TAP_MAX_MOVE = 12;
const TAP_MAX_MS   = 500;
const pr = PixelRatio.get();

type Props = { onTap: () => void; onReady: () => void };

function makeGestureState() {
  return {
    t0: 0, startX: 0, startY: 0,
    startCX: 0, startCY: 0,
    maxMove: 0, multiTouch: false,
    lpActive: false, lpTimer: null as ReturnType<typeof setTimeout> | null, lpRaf: 0,
    pinchActive: false, pinchDist0: 1, pinchZoom0: 1,
    lastMultiTouchEndMs: 0,
  };
}

export default function SplitScreen({ onTap, onReady }: Props) {
  const { width, height } = useWindowDimensions();
  const { cx, cy, mandZoom, julCX, julCY, julZoom, uPhase, uFreq, autopilotPanLocked } = useApp();

  const halfH = Math.round(height / 2);

  // ── Julia gesture ─────────────────────────────────────────────────────────────
  const jg = useRef(makeGestureState()).current;
  const cancelJulLP = () => {
    if (jg.lpTimer) { clearTimeout(jg.lpTimer); jg.lpTimer = null; }
    cancelAnimationFrame(jg.lpRaf); jg.lpActive = false;
  };

  const julPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (evt) => {
      const t = evt.nativeEvent.touches;
      jg.t0 = Date.now(); jg.startX = t[0]?.pageX ?? 0; jg.startY = t[0]?.pageY ?? 0;
      jg.startCX = julCX.current; jg.startCY = julCY.current;
      jg.maxMove = 0; jg.multiTouch = t.length >= 2; jg.lpActive = false; jg.pinchActive = false;
      jg.lpTimer = setTimeout(() => {
        if (jg.maxMove <= LONG_PRESS_MOVE && !jg.multiTouch) {
          jg.lpActive = true;
          const tick = () => { julZoom.current = Math.min(MAX_JULIA_ZOOM, julZoom.current * ZOOM_RATE); jg.lpRaf = requestAnimationFrame(tick); };
          jg.lpRaf = requestAnimationFrame(tick);
        }
      }, LONG_PRESS_MS);
    },
    onPanResponderMove: (evt) => {
      const ts = evt.nativeEvent.touches;
      if (ts.length >= 2) jg.multiTouch = true;
      const dx = ts[0].pageX - jg.startX; const dy = ts[0].pageY - jg.startY;
      jg.maxMove = Math.max(jg.maxMove, Math.hypot(dx, dy));
      if (jg.maxMove > LONG_PRESS_MOVE) cancelJulLP();
      if (jg.lpActive) return;
      if (ts.length >= 2) {
        const dist = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        if (!jg.pinchActive) { jg.pinchActive = true; jg.pinchDist0 = dist; jg.pinchZoom0 = julZoom.current; }
        julZoom.current = Math.max(MIN_JULIA_ZOOM, Math.min(MAX_JULIA_ZOOM, jg.pinchZoom0 * (dist / jg.pinchDist0)));
      } else if (ts.length === 1 && jg.maxMove > TAP_MAX_MOVE && !jg.pinchActive) {
        const scale = julZoom.current * halfH * 0.5;
        julCX.current = jg.startCX - dx / scale; julCY.current = jg.startCY + dy / scale;
      }
    },
    onPanResponderRelease: () => {
      const elapsed = Date.now() - jg.t0;
      const wasMulti = jg.multiTouch;
      const wasTap = jg.maxMove < TAP_MAX_MOVE && elapsed < TAP_MAX_MS
                  && !jg.multiTouch && !jg.lpActive
                  && Date.now() - jg.lastMultiTouchEndMs > 200;
      cancelJulLP(); jg.pinchActive = false; jg.multiTouch = false;
      if (wasMulti) jg.lastMultiTouchEndMs = Date.now();
      if (wasTap) onTap();
    },
    onPanResponderTerminate: () => { cancelJulLP(); jg.pinchActive = false; },
  })).current;

  // ── Mandelbrot gesture ────────────────────────────────────────────────────────
  const mg = useRef(makeGestureState()).current;
  const cancelMandLP = () => {
    if (mg.lpTimer) { clearTimeout(mg.lpTimer); mg.lpTimer = null; }
    cancelAnimationFrame(mg.lpRaf); mg.lpActive = false;
  };

  const mandPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (evt) => {
      const t = evt.nativeEvent.touches;
      mg.t0 = Date.now(); mg.startX = t[0]?.pageX ?? 0; mg.startY = t[0]?.pageY ?? 0;
      mg.startCX = cx.current; mg.startCY = cy.current;
      mg.maxMove = 0; mg.multiTouch = t.length >= 2; mg.lpActive = false; mg.pinchActive = false;
      mg.lpTimer = setTimeout(() => {
        if (mg.maxMove <= LONG_PRESS_MOVE && !mg.multiTouch) {
          mg.lpActive = true;
          const tick = () => { mandZoom.current = Math.min(MAX_ZOOM, mandZoom.current * ZOOM_RATE); mg.lpRaf = requestAnimationFrame(tick); };
          mg.lpRaf = requestAnimationFrame(tick);
        }
      }, LONG_PRESS_MS);
    },
    onPanResponderMove: (evt) => {
      const ts = evt.nativeEvent.touches;
      if (ts.length >= 2) mg.multiTouch = true;
      const dx = ts[0].pageX - mg.startX; const dy = ts[0].pageY - mg.startY;
      mg.maxMove = Math.max(mg.maxMove, Math.hypot(dx, dy));
      if (mg.maxMove > LONG_PRESS_MOVE) cancelMandLP();
      if (mg.lpActive) return;
      if (ts.length >= 2) {
        const dist = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        if (!mg.pinchActive) { mg.pinchActive = true; mg.pinchDist0 = dist; mg.pinchZoom0 = mandZoom.current; }
        mandZoom.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, mg.pinchZoom0 * (dist / mg.pinchDist0)));
      } else if (ts.length === 1 && mg.maxMove > TAP_MAX_MOVE && !mg.pinchActive && !autopilotPanLocked.current) {
        const scale = mandZoom.current * halfH * 0.5;
        cx.current = Math.max(-BOUND, Math.min(BOUND, mg.startCX - dx / scale));
        cy.current = Math.max(-BOUND, Math.min(BOUND, mg.startCY + dy / scale));
      }
    },
    onPanResponderRelease: () => {
      const elapsed = Date.now() - mg.t0;
      const wasMulti = mg.multiTouch;
      const wasTap = mg.maxMove < TAP_MAX_MOVE && elapsed < TAP_MAX_MS
                  && !mg.multiTouch && !mg.lpActive
                  && Date.now() - mg.lastMultiTouchEndMs > 200;
      cancelMandLP(); mg.pinchActive = false; mg.multiTouch = false;
      if (wasMulti) mg.lastMultiTouchEndMs = Date.now();
      if (wasTap) onTap();
    },
    onPanResponderTerminate: () => { cancelMandLP(); mg.pinchActive = false; },
  })).current;

  // ── Ready tracking — signal onReady after both GL contexts draw their first frame ──
  const readyCount = useRef(0);
  const signalReady = () => { if (++readyCount.current >= 2) onReady(); };

  // ── Julia GL ──────────────────────────────────────────────────────────────────
  const onJulia = useCallback((gl: ExpoWebGLRenderingContext) => {
    const prog    = makeProgram(gl, JULIA_FRAG);
    const uRes    = gl.getUniformLocation(prog, 'u_res');
    const uC      = gl.getUniformLocation(prog, 'u_c');
    const uCenter = gl.getUniformLocation(prog, 'u_center');
    const uZoom   = gl.getUniformLocation(prog, 'u_zoom');
    const uPhaseL = gl.getUniformLocation(prog, 'u_phase');
    const uFreqL  = gl.getUniformLocation(prog, 'u_freq');
    let raf = 0;
    const draw = () => {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uC, cx.current, cy.current);
      gl.uniform2f(uCenter, julCX.current, julCY.current);
      gl.uniform1f(uZoom, julZoom.current);
      gl.uniform3fv(uPhaseL, uPhase.current);
      gl.uniform1f(uFreqL,  uFreq.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.endFrameEXP();
      if (!signalled) { signalled = true; signalReady(); }
      raf = requestAnimationFrame(draw);
    };
    let signalled = false;
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Mandelbrot GL ─────────────────────────────────────────────────────────────
  const onMandelbrot = useCallback((gl: ExpoWebGLRenderingContext) => {
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
      if (!signalled2) { signalled2 = true; signalReady(); }
      raf = requestAnimationFrame(draw);
    };
    let signalled2 = false;
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const mhw = width  / 2;
  const mhh = halfH  / 2;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Julia — top half */}
      <View style={{ width, height: halfH }} {...julPan.panHandlers}>
        <GLView style={{ width, height: halfH }} onContextCreate={onJulia} />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Mandelbrot — bottom half */}
      <View style={{ width, height: halfH }} {...mandPan.panHandlers}>
        <GLView style={{ width, height: halfH }} onContextCreate={onMandelbrot} />
        <View style={[styles.armL, { top: mhh - 0.5, left: mhw - 30 }]} />
        <View style={[styles.armR, { top: mhh - 0.5, left: mhw +  8 }]} />
        <View style={[styles.armU, { top: mhh - 30,  left: mhw - 0.5 }]} />
        <View style={[styles.armD, { top: mhh +  8,  left: mhw - 0.5 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  armL: { position: 'absolute', width: 22, height: 1,  backgroundColor: '#ffffff' },
  armR: { position: 'absolute', width: 22, height: 1,  backgroundColor: '#ffffff' },
  armU: { position: 'absolute', width: 1,  height: 22, backgroundColor: '#ffffff' },
  armD: { position: 'absolute', width: 1,  height: 22, backgroundColor: '#ffffff' },
});
