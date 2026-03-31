import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { makeProgram } from '../gl/makeProgram';
import { MANDELBROT_FRAG, JULIA_FRAG } from '../gl/shaders';
import { useApp } from '../context/AppContext';
import {
  BOUND, JULIA_ZOOM, MAX_JULIA_ZOOM, MAX_ZOOM, MIN_ZOOM, PIP_MARGIN, PIP_SIZE,
  LONG_PRESS_MS, LONG_PRESS_MOVE, ZOOM_RATE,
} from '../constants';

const TAP_MAX_MOVE = 12;
const TAP_MAX_MS   = 500;

type Props = { onTap: () => void; onReady: () => void };

export default function MandelbrotBg({ onTap, onReady }: Props) {
  const { width, height } = useWindowDimensions();
  const insets      = useSafeAreaInsets();
  const isLandscape = width > height;

  const { cx, cy, mandZoom, uPhase, uFreq, autopilotPanLocked } = useApp();

  // ── Expanded Julia viewport refs — never touch cx/cy (those are the c-parameter) ──
  const expJulCX   = useRef(0);
  const expJulCY   = useRef(0);
  const expJulZoom = useRef(JULIA_ZOOM);
  const juliaGLRef = useRef<ExpoWebGLRenderingContext | null>(null);

  // Ref so PanResponder closures (created once) can read current juliaOpen state
  const juliaOpenRef = useRef(false);

  // ── Julia PiP expand / collapse ──────────────────────────────────────────────
  const [juliaOpen, setJuliaOpen] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const openJulia = () => {
    expJulCX.current   = 0;
    expJulCY.current   = 0;
    expJulZoom.current = (PIP_SIZE * JULIA_ZOOM) / Math.min(width, height);
    juliaOpenRef.current = true;
    setJuliaOpen(true);
    requestAnimationFrame(() => {
      Animated.spring(fadeAnim, {
        toValue: 1, useNativeDriver: true, speed: 18, bounciness: 0,
      }).start();
    });
  };

  const closeJulia = () => {
    Animated.spring(fadeAnim, {
      toValue: 0, useNativeDriver: true, speed: 24, bounciness: 0,
    }).start(({ finished }) => {
      if (finished) {
        expJulCX.current   = 0;
        expJulCY.current   = 0;
        expJulZoom.current = (PIP_SIZE * JULIA_ZOOM) / Math.min(width, height);
        juliaOpenRef.current = false;
        setJuliaOpen(false);
      }
    });
  };

  // ── Mandelbrot gesture state ──────────────────────────────────────────────────
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
    // Yield to expPan when Julia is expanded — prevents responder stealing on move
    onStartShouldSetPanResponder:        () => !juliaOpenRef.current,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder:         () => !juliaOpenRef.current,

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
          const tick = () => { mandZoom.current = Math.min(MAX_ZOOM, mandZoom.current * ZOOM_RATE); g.lpRaf = requestAnimationFrame(tick); };
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

  // ── Expanded Julia gesture state ──────────────────────────────────────────────
  // Writes only to expJulCX/CY/Zoom — cx/cy are never touched here
  const eg = useRef({
    t0: 0, startX: 0, startY: 0, startCX: 0, startCY: 0,
    maxMove: 0, multiTouch: false,
    lpActive: false, lpTimer: null as ReturnType<typeof setTimeout> | null, lpRaf: 0,
    pinchActive: false, pinchDist0: 1, pinchZoom0: 1,
  }).current;

  const cancelExpLP = () => {
    if (eg.lpTimer) { clearTimeout(eg.lpTimer); eg.lpTimer = null; }
    cancelAnimationFrame(eg.lpRaf);
    eg.lpActive = false;
  };

  const expPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,

    onPanResponderGrant: (evt) => {
      const t = evt.nativeEvent.touches;
      eg.startX = t[0]?.pageX ?? 0; eg.startY = t[0]?.pageY ?? 0;
      eg.startCX = expJulCX.current; eg.startCY = expJulCY.current;
      eg.maxMove = 0; eg.multiTouch = t.length >= 2;
      eg.lpActive = false; eg.pinchActive = false;
      eg.lpTimer = setTimeout(() => {
        if (eg.maxMove <= LONG_PRESS_MOVE && !eg.multiTouch) {
          eg.lpActive = true;
          const tick = () => { expJulZoom.current = Math.min(MAX_JULIA_ZOOM, expJulZoom.current * ZOOM_RATE); eg.lpRaf = requestAnimationFrame(tick); };
          eg.lpRaf = requestAnimationFrame(tick);
        }
      }, LONG_PRESS_MS);
    },

    onPanResponderMove: (evt) => {
      const ts = evt.nativeEvent.touches;
      if (ts.length >= 2) eg.multiTouch = true;
      const dx = ts[0].pageX - eg.startX;
      const dy = ts[0].pageY - eg.startY;
      eg.maxMove = Math.max(eg.maxMove, Math.hypot(dx, dy));
      if (eg.maxMove > LONG_PRESS_MOVE) cancelExpLP();
      if (eg.lpActive) return;
      if (ts.length >= 2) {
        const dist = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        if (!eg.pinchActive) { eg.pinchActive = true; eg.pinchDist0 = dist; eg.pinchZoom0 = expJulZoom.current; }
        expJulZoom.current = Math.max(JULIA_ZOOM * 0.1, Math.min(MAX_JULIA_ZOOM,
          eg.pinchZoom0 * (dist / eg.pinchDist0)));
      } else if (ts.length === 1 && eg.maxMove > TAP_MAX_MOVE && !eg.pinchActive) {
        const scale = expJulZoom.current * Math.min(width, height) * 0.5;
        expJulCX.current = eg.startCX - dx / scale;
        expJulCY.current = eg.startCY + dy / scale;
      }
    },

    onPanResponderRelease: () => { cancelExpLP(); eg.pinchActive = false; eg.multiTouch = false; },
    onPanResponderTerminate: () => { cancelExpLP(); eg.pinchActive = false; },
  })).current;

  // ── Screenshot ───────────────────────────────────────────────────────────────
  const takeScreenshot = async () => {
    if (!juliaGLRef.current) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to save screenshots.');
        return;
      }
      const snap = await GLView.takeSnapshotAsync(juliaGLRef.current, { format: 'png' });
      await MediaLibrary.saveToLibraryAsync(snap.uri as string);
      Alert.alert('Saved', 'Screenshot added to Photos.');
    } catch (e) {
      console.warn('Screenshot failed', e);
    }
  };

  // ── Ready tracking ────────────────────────────────────────────────────────────
  const readyCount = useRef(0);
  const signalReady = () => { if (++readyCount.current >= 2) onReady(); };

  // ── Mandelbrot GL ─────────────────────────────────────────────────────────────
  const onMandelbrot = useCallback((gl: ExpoWebGLRenderingContext) => {
    const prog    = makeProgram(gl, MANDELBROT_FRAG);
    const uRes    = gl.getUniformLocation(prog, 'u_res');
    const uCenter = gl.getUniformLocation(prog, 'u_center');
    const uZoom   = gl.getUniformLocation(prog, 'u_zoom');
    const uPhaseL = gl.getUniformLocation(prog, 'u_phase');
    const uFreqL  = gl.getUniformLocation(prog, 'u_freq');
    let raf = 0;
    let signalled = false;
    const draw = () => {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uCenter, cx.current, cy.current);
      gl.uniform1f(uZoom, mandZoom.current);
      gl.uniform3fv(uPhaseL, uPhase.current);
      gl.uniform1f(uFreqL,   uFreq.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.endFrameEXP();
      if (!signalled) { signalled = true; signalReady(); }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Julia PiP GL ─────────────────────────────────────────────────────────────
  const onJuliaPip = useCallback((gl: ExpoWebGLRenderingContext) => {
    const prog    = makeProgram(gl, JULIA_FRAG);
    const uRes    = gl.getUniformLocation(prog, 'u_res');
    const uC      = gl.getUniformLocation(prog, 'u_c');
    const uCenter = gl.getUniformLocation(prog, 'u_center');
    const uZoom   = gl.getUniformLocation(prog, 'u_zoom');
    const uPhaseL = gl.getUniformLocation(prog, 'u_phase');
    const uFreqL  = gl.getUniformLocation(prog, 'u_freq');
    let raf = 0;
    let signalled2 = false;
    const draw = () => {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uC, cx.current, cy.current);
      gl.uniform2f(uCenter, 0, 0);
      gl.uniform1f(uZoom, JULIA_ZOOM);
      gl.uniform3fv(uPhaseL, uPhase.current);
      gl.uniform1f(uFreqL,   uFreq.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.endFrameEXP();
      if (!signalled2) { signalled2 = true; signalReady(); }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Julia fullscreen GL — viewport driven by expJulCX/CY/Zoom ────────────────
  const onJuliaFull = useCallback((gl: ExpoWebGLRenderingContext) => {
    juliaGLRef.current = gl;
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
      gl.uniform2f(uC,      cx.current,         cy.current);          // Julia c-param: fixed
      gl.uniform2f(uCenter, expJulCX.current,   expJulCY.current);    // viewport pan
      gl.uniform1f(uZoom,   expJulZoom.current);                       // viewport zoom
      gl.uniform3fv(uPhaseL, uPhase.current);
      gl.uniform1f(uFreqL,   uFreq.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.endFrameEXP();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); juliaGLRef.current = null; };
  }, []);

  // ── Layout ────────────────────────────────────────────────────────────────────
  const hw = width  / 2;
  const hh = height / 2;

  const pipPos = isLandscape
    ? { top: insets.top + PIP_MARGIN, left:  insets.left + PIP_MARGIN }
    : { top: insets.top + PIP_MARGIN, right: PIP_MARGIN };

  const ctrlOpacity = fadeAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, 1] });

  return (
    <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
      {/* Mandelbrot — fullscreen */}
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onMandelbrot} />

      {/* Crosshair */}
      <View style={[styles.armL, { top: hh - 0.5, left: hw - 30 }]} />
      <View style={[styles.armR, { top: hh - 0.5, left: hw +  8 }]} />
      <View style={[styles.armU, { top: hh - 30,  left: hw - 0.5 }]} />
      <View style={[styles.armD, { top: hh +  8,  left: hw - 0.5 }]} />

      {/* Julia PiP */}
      <View style={[styles.pip, pipPos]}>
        <GLView style={{ width: PIP_SIZE, height: PIP_SIZE }} onContextCreate={onJuliaPip} />
        <Pressable style={StyleSheet.absoluteFill} onPress={openJulia} />
      </View>

      {/* ── Expanded Julia ────────────────────────────────────────────────────── */}
      {/*
        Not a Modal — rendered as a child of the outer pan View.
        On Android, Modal PanResponders lose the responder race to a PanResponder
        in the native view hierarchy below. As a child, expPan wins the bubble
        phase because the parent pan has onStartShouldSetPanResponderCapture=false.
        backgroundColor="#000" gives the View a touch surface on Android.
      */}
      {juliaOpen && (
        <>
          <View collapsable={false} style={[StyleSheet.absoluteFill, styles.expandedBg]} {...expPan.panHandlers}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
              <GLView style={StyleSheet.absoluteFill} onContextCreate={onJuliaFull} />
            </Animated.View>
          </View>

          {/* Controls — sibling of expPan so its Pressables aren't blocked by expPan */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: ctrlOpacity }]}
            pointerEvents="box-none"
          >
            <Pressable
              style={[styles.closeBtn, { top: insets.top + 14, right: 14 }]}
              onPress={closeJulia}
              hitSlop={12}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>

            <Pressable
              style={[styles.cameraBtn, { bottom: insets.bottom + 28, left: (width - 66) / 2 }]}
              onPress={takeScreenshot}
              hitSlop={8}
            >
              <Ionicons name="camera" size={30} color="#fff" />
            </Pressable>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  armL: { position: 'absolute', width: 22, height: 1,  backgroundColor: '#ffffff' },
  armR: { position: 'absolute', width: 22, height: 1,  backgroundColor: '#ffffff' },
  armU: { position: 'absolute', width: 1,  height: 22, backgroundColor: '#ffffff' },
  armD: { position: 'absolute', width: 1,  height: 22, backgroundColor: '#ffffff' },

  expandedBg: { backgroundColor: '#000' },

  pip: {
    position: 'absolute',
    width: PIP_SIZE, height: PIP_SIZE,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
    overflow: 'hidden',
  },

  closeBtn: {
    position: 'absolute',
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },

  cameraBtn: {
    position: 'absolute',
    width: 66, height: 66, borderRadius: 33,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
});
