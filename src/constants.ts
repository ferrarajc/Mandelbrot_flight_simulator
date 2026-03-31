// ─── Layout ───────────────────────────────────────────────────────────────────
export const PIP_SIZE    = 200;
export const PIP_MARGIN  = 12;
export const DIVIDER_H   = 1;    // split screen divider line height

// ─── Fractal limits ───────────────────────────────────────────────────────────
export const MAX_ZOOM       = 500;
export const MIN_ZOOM       = 0.4;
export const MAX_JULIA_ZOOM = 8.0;
export const MIN_JULIA_ZOOM = 0.25;  // visible half-height = 1/0.25 = 4 units — Julia set (radius 2) with room to spare
export const BOUND          = 2.0;

// ─── Initial Mandelbrot state ─────────────────────────────────────────────────
export const INIT_CX   =  0.0;
export const INIT_CY   =  0.0;
export const INIT_ZOOM = MIN_ZOOM;

// ─── Julia PiP (used in MandelbrotBg view) ───────────────────────────────────
export const JULIA_ZOOM = 0.75;   // shows ±2.67 units — full Julia set with margin

// ─── Mandelbrot PiP (used in JuliaBg view, fixed — not navigable) ────────────
export const PIP_MAND_ZOOM     = MIN_ZOOM;
export const PIP_MAND_CENTER_X = -0.5;   // centers the Mandelbrot set nicely
export const PIP_MAND_CENTER_Y =  0.0;

// ─── Color Schemes ────────────────────────────────────────────────────────────
export type ColorScheme = {
  id: string;
  label: string;
  freq: number;
  phase: [number, number, number];
};

// Helper: evaluate the cosine palette at t ∈ [0,1] → CSS rgb string
export function evalPalette(t: number, s: ColorScheme): string {
  const c = (ph: number) =>
    Math.round(255 * (0.5 + 0.5 * Math.cos(2 * Math.PI * (t * s.freq + ph))));
  return `rgb(${c(s.phase[0])},${c(s.phase[1])},${c(s.phase[2])})`;
}

export const COLOR_SCHEMES: ColorScheme[] = [
  { id: 'electric', label: 'Electric', freq: 3.0, phase: [0.0,  0.333, 0.667] },
  { id: 'fire',     label: 'Fire',     freq: 2.5, phase: [0.0,  0.12,  0.25 ] },
  { id: 'ice',      label: 'Ice',      freq: 2.0, phase: [0.5,  0.62,  0.75 ] },
  { id: 'neon',     label: 'Neon',     freq: 4.0, phase: [0.0,  0.25,  0.5  ] },
  { id: 'gold',     label: 'Gold',     freq: 3.0, phase: [0.0,  0.09,  0.18 ] },
  // ── New schemes ───────────────────────────────────────────────────────────────
  // Aurora: slow cycle between lime-green and deep magenta — northern-lights feel
  { id: 'aurora',  label: 'Aurora',  freq: 1.5, phase: [0.5,  0.0,   0.33 ] },
  // Cosmic: deep blue/indigo to warm amber — interstellar palette
  { id: 'cosmic',  label: 'Cosmic',  freq: 1.8, phase: [0.6,  0.2,   0.9  ] },
  // Candy: fast-cycling hot-pink, cyan, and yellow — maximally saturated
  { id: 'candy',   label: 'Candy',   freq: 4.5, phase: [0.0,  0.25,  0.6  ] },
];

// t-values for the split-disc color swatch
export const DISC_T_OUTSIDE = 0.01;   // far outside the set
export const DISC_T_EDGE    = 0.22;   // near the boundary

// ─── Views ────────────────────────────────────────────────────────────────────
export type ViewMode = 'mandelbrot' | 'julia' | 'split' | 'mandelbrot_only' | 'julia_only';

export const VIEW_LABELS: Record<ViewMode, string> = {
  mandelbrot:      'Mandelbrot in background',
  julia:           'Julia in background',
  split:           'Split screen',
  mandelbrot_only: 'Just Mandelbrot',
  julia_only:      'Just Julia',
};

// ─── Autopilot ────────────────────────────────────────────────────────────────
// Speed is a continuous number: 0 = off, 1–20 = pixels per second at current zoom
export const AUTOPILOT_MAX_PX = 20;

export function autopilotSpeedLabel(px: number): string {
  if (px === 0)  return 'Off';
  if (px < 4)   return 'Very slow';
  if (px < 8)   return 'Slow';
  if (px < 12)  return 'Normal';
  if (px < 16)  return 'Fast';
  return 'Very fast';
}

export type AutopilotPath =
  | 'north' | 'south' | 'east' | 'west'
  | 'cardioid' | 'scenic' | 'bulb' | 'figure8';

// ─── Gesture thresholds ───────────────────────────────────────────────────────
export const TAP_MAX_MOVE_PX = 8;
export const TAP_MAX_MS      = 300;
export const LONG_PRESS_MS   = 850;
export const LONG_PRESS_MOVE = 8;
export const ZOOM_RATE       = 1.018;   // multiplier per RAF frame during long-press zoom
