import React, { useCallback, useRef } from 'react';
import {
  PanResponder,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';

// ─── Constants ────────────────────────────────────────────────────────────────
const PIP_SIZE   = 200;
const PIP_MARGIN = 16;
const MAX_ZOOM   = 500;
const MIN_ZOOM   = 0.4;
const JULIA_ZOOM = 1.5;
const BOUND      = 2.0;

// ─── GLSL Shaders ─────────────────────────────────────────────────────────────
const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Color: smooth cosine palette, same for both fractals
const COLOR_GLSL = `
vec3 palette(float t) {
  return 0.5 + 0.5 * cos(6.2832 * (t * 3.0 + vec3(0.0, 0.333, 0.667)));
}
`;

const MANDELBROT_FRAG = `
precision highp float;
uniform vec2 u_res;
uniform vec2 u_center;
uniform float u_zoom;
${COLOR_GLSL}
void main() {
  float scale = u_zoom * u_res.y * 0.5;
  vec2 c = (gl_FragCoord.xy - u_res * 0.5) / scale + u_center;
  vec2 z = vec2(0.0);
  float iter = 200.0;
  float mag2 = 0.0;
  for (int i = 0; i < 200; i++) {
    float x2 = z.x * z.x;
    float y2 = z.y * z.y;
    mag2 = x2 + y2;
    if (mag2 > 4.0) { iter = float(i); break; }
    z = vec2(x2 - y2 + c.x, 2.0 * z.x * z.y + c.y);
  }
  if (iter == 200.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float nu = log2(log2(mag2) * 0.5);
  float t  = clamp((iter + 1.0 - nu) / 200.0, 0.0, 1.0);
  gl_FragColor = vec4(palette(t), 1.0);
}
`;

const JULIA_FRAG = `
precision highp float;
uniform vec2 u_res;
uniform vec2 u_c;
uniform float u_zoom;
${COLOR_GLSL}
void main() {
  float scale = u_zoom * u_res.y * 0.5;
  vec2 z = (gl_FragCoord.xy - u_res * 0.5) / scale;
  float iter = 150.0;
  float mag2 = 0.0;
  for (int i = 0; i < 150; i++) {
    float x2 = z.x * z.x;
    float y2 = z.y * z.y;
    mag2 = x2 + y2;
    if (mag2 > 4.0) { iter = float(i); break; }
    z = vec2(x2 - y2 + u_c.x, 2.0 * z.x * z.y + u_c.y);
  }
  if (iter == 150.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float nu = log2(log2(mag2) * 0.5);
  float t  = clamp((iter + 1.0 - nu) / 150.0, 0.0, 1.0);
  gl_FragColor = vec4(palette(t), 1.0);
}
`;

// ─── WebGL helpers ────────────────────────────────────────────────────────────
function makeProgram(gl: ExpoWebGLRenderingContext, fragSrc: string) {
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (__DEV__ && !gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  // Fullscreen quad (2 triangles)
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),
    gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  return prog;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function App() {
  const { width, height } = useWindowDimensions();

  // All gesture state in refs — no React re-renders on every frame
  const cx   = useRef(0);
  const cy   = useRef(0);
  const zoom = useRef(1);

  const gst = useRef({
    startCX: 0, startCY: 0, startTX: 0, startTY: 0,
    pinchActive: false, pinchStartDist: 1, pinchStartZoom: 1,
  });

  // ── Mandelbrot GL setup ──────────────────────────────────────────────────
  const onMandelbrot = useCallback((gl: ExpoWebGLRenderingContext) => {
    const prog = makeProgram(gl, MANDELBROT_FRAG);
    const uRes    = gl.getUniformLocation(prog, 'u_res');
    const uCenter = gl.getUniformLocation(prog, 'u_center');
    const uZoom   = gl.getUniformLocation(prog, 'u_zoom');
    let raf = 0;
    const draw = () => {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uCenter, cx.current, cy.current);
      gl.uniform1f(uZoom, zoom.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.endFrameEXP();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Julia GL setup ──────────────────────────────────────────────────────
  const onJulia = useCallback((gl: ExpoWebGLRenderingContext) => {
    const prog = makeProgram(gl, JULIA_FRAG);
    const uRes  = gl.getUniformLocation(prog, 'u_res');
    const uC    = gl.getUniformLocation(prog, 'u_c');
    const uZoom = gl.getUniformLocation(prog, 'u_zoom');
    let raf = 0;
    const draw = () => {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uC, cx.current, cy.current);
      gl.uniform1f(uZoom, JULIA_ZOOM);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.endFrameEXP();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Gestures ────────────────────────────────────────────────────────────
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,

    onPanResponderGrant: (evt) => {
      const g = gst.current;
      const t = evt.nativeEvent.touches;
      g.startCX = cx.current;
      g.startCY = cy.current;
      g.startTX = t[0]?.pageX ?? 0;
      g.startTY = t[0]?.pageY ?? 0;
      g.pinchActive = false;
    },

    onPanResponderMove: (evt) => {
      const g  = gst.current;
      const ts = evt.nativeEvent.touches;

      if (ts.length >= 2) {
        const dx   = ts[0].pageX - ts[1].pageX;
        const dy   = ts[0].pageY - ts[1].pageY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (!g.pinchActive) {
          g.pinchActive    = true;
          g.pinchStartDist = dist;
          g.pinchStartZoom = zoom.current;
        } else {
          zoom.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM,
            g.pinchStartZoom * (dist / g.pinchStartDist)));
        }
      } else if (ts.length === 1 && !g.pinchActive) {
        const scale = zoom.current * height * 0.5;
        cx.current = Math.max(-BOUND, Math.min(BOUND,
          g.startCX - (ts[0].pageX - g.startTX) / scale));
        cy.current = Math.max(-BOUND, Math.min(BOUND,
          g.startCY - (ts[0].pageY - g.startTY) / scale));
      }
    },

    onPanResponderRelease: () => { gst.current.pinchActive = false; },
  })).current;

  // Crosshair geometry
  const hw = width  / 2;
  const hh = height / 2;

  return (
    <View style={styles.root} {...pan.panHandlers}>
      <StatusBar hidden />

      {/* Mandelbrot — fullscreen */}
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onMandelbrot} />

      {/* Crosshair */}
      <View style={[styles.crossH, { top: hh - 0.5, left: hw - 30 }]} />
      <View style={[styles.crossV, { top: hh - 30,  left: hw - 0.5 }]} />
      <View style={[styles.dot,    { top: hh - 2,   left: hw - 2   }]} />

      {/* Julia PiP */}
      <View style={styles.pip}>
        <GLView
          style={{ width: PIP_SIZE, height: PIP_SIZE }}
          onContextCreate={onJulia}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#000' },
  crossH: { position: 'absolute', width: 60,  height: 1, backgroundColor: 'rgba(255,255,255,0.85)' },
  crossV: { position: 'absolute', width: 1,   height: 60, backgroundColor: 'rgba(255,255,255,0.85)' },
  dot:    { position: 'absolute', width: 4,   height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.95)' },
  pip: {
    position: 'absolute', right: PIP_MARGIN, bottom: PIP_MARGIN,
    width: PIP_SIZE, height: PIP_SIZE,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
  },
});
