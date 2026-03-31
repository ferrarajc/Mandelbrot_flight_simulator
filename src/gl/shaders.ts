export const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Parameterized palette — freq and phase passed as uniforms so the color
// scheme can be changed at runtime without recreating the GL context.
const PALETTE_GLSL = `
uniform vec3 u_phase;
uniform float u_freq;
vec3 palette(float t) {
  return 0.5 + 0.5 * cos(6.2832 * (t * u_freq + u_phase));
}
`;

export const MANDELBROT_FRAG = `
precision highp float;
uniform vec2  u_res;
uniform vec2  u_center;
uniform float u_zoom;
${PALETTE_GLSL}
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

// Julia shader now accepts u_center so the view can be panned independently
// of the Julia parameter u_c.
export const JULIA_FRAG = `
precision highp float;
uniform vec2  u_res;
uniform vec2  u_c;       /* Julia parameter c (crosshair position) */
uniform vec2  u_center;  /* viewport center — pan the Julia view   */
uniform float u_zoom;
${PALETTE_GLSL}
void main() {
  float scale = u_zoom * u_res.y * 0.5;
  vec2 z = (gl_FragCoord.xy - u_res * 0.5) / scale + u_center;
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
