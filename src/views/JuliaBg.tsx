import React, { useCallback, useRef } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeProgram } from '../gl/makeProgram';
import { MANDELBROT_FRAG, JULIA_FRAG } from '../gl/shaders';
import { useApp } from '../context/AppContext';
import {
  BOUND, MAX_JULIA_ZOOM, MIN_JULIA_ZOOM, JULIA_ZOOM, PIP_MARGIN, PIP_SIZE,
  PIP_MAND_ZOOM, PIP_MAND_CENTER_X, PIP_MAND_CENTER_Y,
  LONG_PRESS_MS, LONG_PRESS_MOVE, ZOOM_RATE,
} from '../constants';

const TAP_MAX_MOVE = 12;
const TAP_MAX_MS   = 500;

type Props = { onTap: () => void; onReady: () => void };

function fracToPip(fx: number, fy: number) {
  const scale = PIP_MAND_ZOOM * PIP_SIZE * 0.5;
  return {
    x: PIP_SIZE / 2 + (fx - PIP_MAND_CENTER_X) * scale,
    y: PIP_SIZE / 2 - fy * scale,
  };
}

function pipToFrac(px: number, py: number) {
  const scale = PIP_MAND_ZOOM * PIP_SIZE * 0.5;
  return {
    cx: Math.max(-BOUND, Math.min(BOUND, (px - PIP_SIZE / 2) / scale + PIP_MAND_CENTER_X)),
    cy: Math.max(-BOUND, Math.min(BOUND, (PIP_SIZE / 2 - py) / scale)),
  };
}

export default function JuliaBg({ onTap, onReady }: Props) {
  const { width, height } = useWindowDimensions();
  const insets     = useSafeAreaInsets();
  const isLandscape = width > height;

  const { cx, cy, julCX, julCY, julZoom, uPhase, uFreq } = useApp();

  const xhRef    = useRef<View>(null);
  const pipViewRef = useRef<View>(null);

  const updatePipCrosshair = useCallback(() => {
    const { x, y } = fracToPip(cx.current, cy.current);
    xhRef.current?.setNativeProps({ style: { left: x - 5, top: y - 5 } });
  }, []);

  // Tracks whether pipPan holds the responder — julPan yields while true
  const pipActiveRef = useRef(false);

  // ── Julia (fullscreen) gesture ────────────────────────────────────────────────
  const jg = useRef({
    t0: 0, startX: 0, startY: 0, startJulCX: 0, startJulCY: 0,
    maxMove: 0, multiTouch: false,
    lpActive: false, lpTimer: null as ReturnType<typeof setTimeout> | null, lpRaf: 0,
    pinchActive: false, pinchDist0: 1, pinchZoom0: 1,
    lastMultiTouchEndMs: 0,
  }).current;

  const cancelJulLP = () => {
    if (jg.lpTimer) { clearTimeout(jg.lpTimer); jg.lpTimer = null; }
    cancelAnimationFrame(jg.lpRaf);
    jg.lpActive = false;
  };

  const julPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !pipActiveRef.current,
    onMoveShouldSetPanResponder:  () => !pipActiveRef.current,

    onPanResponderGrant: (evt) => {
      const t = evt.nativeEvent.touches;
      jg.t0 = Date.now();
      jg.startX = t[0]?.pageX ?? 0; jg.startY = t[0]?.pageY ?? 0;
      jg.startJulCX = julCX.current; jg.startJulCY = julCY.current;
      jg.maxMove = 0; jg.multiTouch = t.length >= 2;
      jg.lpActive = false; jg.pinchActive = false;
      jg.lpTimer = setTimeout(() => {
        if (jg.maxMove <= LONG_PRESS_MOVE && !jg.multiTouch) {
          jg.lpActive = true;
          const tick = () => {
            julZoom.current = Math.min(MAX_JULIA_ZOOM, julZoom.current * ZOOM_RATE);
            jg.lpRaf = requestAnimationFrame(tick);
          };
          jg.lpRaf = requestAnimationFrame(tick);
        }
      }, LONG_PRESS_MS);
    },

    onPanResponderMove: (evt) => {
      const ts = evt.nativeEvent.touches;
      if (ts.length >= 2) jg.multiTouch = true;
      const dx = ts[0].pageX - jg.startX;
      const dy = ts[0].pageY - jg.startY;
      jg.maxMove = Math.max(jg.maxMove, Math.hypot(dx, dy));
      if (jg.maxMove > LONG_PRESS_MOVE) cancelJulLP();
      if (jg.lpActive) return;
      if (ts.length >= 2) {
        const dist = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        if (!jg.pinchActive) { jg.pinchActive = true; jg.pinchDist0 = dist; jg.pinchZoom0 = julZoom.current; }
        julZoom.current = Math.max(MIN_JULIA_ZOOM, Math.min(MAX_JULIA_ZOOM, jg.pinchZoom0 * (dist / jg.pinchDist0)));
      } else if (ts.length === 1 && jg.maxMove > TAP_MAX_MOVE && !jg.pinchActive) {
        const scale = julZoom.current * height * 0.5;
        julCX.current = jg.startJulCX - dx / scale;
        julCY.current = jg.startJulCY + dy / scale;
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

  // ── PiP crosshair drag gesture ────────────────────────────────────────────────
  const pg = useRef({ pipScreenX: 0, pipScreenY: 0 }).current;

  const pipPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,

    onPanResponderGrant: () => {
      pipActiveRef.current = true;
      pipViewRef.current?.measure((_, __, ___, ____, pageX, pageY) => {
        pg.pipScreenX = pageX;
        pg.pipScreenY = pageY;
      });
    },

    onPanResponderMove: (evt) => {
      const t = evt.nativeEvent.touches[0];
      const localX = t.pageX - pg.pipScreenX;
      const localY = t.pageY - pg.pipScreenY;
      const frac = pipToFrac(localX, localY);
      cx.current = frac.cx;
      cy.current = frac.cy;
      updatePipCrosshair();
    },

    onPanResponderRelease:   () => { pipActiveRef.current = false; },
    onPanResponderTerminate: () => { pipActiveRef.current = false; },
  })).current;

  // ── Ready tracking ────────────────────────────────────────────────────────────
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

  // ── Mandelbrot PiP GL ─────────────────────────────────────────────────────────
  const onMandPip = useCallback((gl: ExpoWebGLRenderingContext) => {
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
      gl.uniform2f(uCenter, PIP_MAND_CENTER_X, PIP_MAND_CENTER_Y);
      gl.uniform1f(uZoom, PIP_MAND_ZOOM);
      gl.uniform3fv(uPhaseL, uPhase.current);
      gl.uniform1f(uFreqL,  uFreq.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.endFrameEXP();
      // Keep crosshair in sync with cx/cy (autopilot or manual drag)
      const { x, y } = fracToPip(cx.current, cy.current);
      xhRef.current?.setNativeProps({ style: { left: x - 5, top: y - 5 } });
      if (!signalled2) { signalled2 = true; signalReady(); }
      raf = requestAnimationFrame(draw);
    };
    let signalled2 = false;
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const { x: initXhX, y: initXhY } = fracToPip(cx.current, cy.current);
  const pipPos = isLandscape
    ? { top: insets.top + PIP_MARGIN, right: PIP_MARGIN }
    : { bottom: insets.bottom + PIP_MARGIN, right: PIP_MARGIN };

  return (
    <View style={StyleSheet.absoluteFill} {...julPan.panHandlers}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onJulia} />

      <View collapsable={false} ref={pipViewRef} style={[styles.pip, pipPos]} {...pipPan.panHandlers}>
        <GLView style={{ width: PIP_SIZE, height: PIP_SIZE }} onContextCreate={onMandPip} />
        <View
          ref={xhRef}
          style={[styles.miniXh, { left: initXhX - 5, top: initXhY - 5 }]}
          pointerEvents="none"
        >
          <View style={styles.mArmL} />
          <View style={styles.mArmR} />
          <View style={styles.mArmU} />
          <View style={styles.mArmD} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pip: {
    position: 'absolute',
    width: PIP_SIZE, height: PIP_SIZE,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  miniXh: { position: 'absolute', width: 10, height: 10 },
  mArmL: { position: 'absolute', top: 4.5, left: 0,   width: 3, height: 1, backgroundColor: '#fff' },
  mArmR: { position: 'absolute', top: 4.5, left: 7,   width: 3, height: 1, backgroundColor: '#fff' },
  mArmU: { position: 'absolute', top: 0,   left: 4.5, width: 1, height: 3, backgroundColor: '#fff' },
  mArmD: { position: 'absolute', top: 7,   left: 4.5, width: 1, height: 3, backgroundColor: '#fff' },
});
