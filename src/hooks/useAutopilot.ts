import { MutableRefObject, useEffect, useRef } from 'react';
import { AutopilotPath, BOUND } from '../constants';

// ── Cardioid arc-length table ──────────────────────────────────────────────────
// Scaled 5% outside the boundary to show more of the chaotic fringe
const CARD_SCALE = 1.015;
const _CN = 1000;
const _cT = Array.from({ length: _CN + 1 }, (_, i) => (2 * Math.PI * i) / _CN);
const _cX = (t: number) => CARD_SCALE * (0.5 * Math.cos(t) - 0.25 * Math.cos(2 * t));
const _cY = (t: number) => CARD_SCALE * (0.5 * Math.sin(t) - 0.25 * Math.sin(2 * t));
const _cDist: number[] = [0];
for (let i = 1; i <= _CN; i++) {
  _cDist.push(_cDist[i-1] + Math.hypot(_cX(_cT[i]) - _cX(_cT[i-1]), _cY(_cT[i]) - _cY(_cT[i-1])));
}
const CARD_LEN = _cDist[_CN];

function cardTAtDist(d: number): number {
  const target = ((d % CARD_LEN) + CARD_LEN) % CARD_LEN;
  let lo = 0, hi = _CN;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (_cDist[mid] <= target) lo = mid; else hi = mid; }
  const d0 = _cDist[lo], d1 = _cDist[hi];
  return d1 === d0 ? _cT[lo] : _cT[lo] + (target - d0) / (d1 - d0) * (_cT[hi] - _cT[lo]);
}

// ── Period-2 bulb circuit ──────────────────────────────────────────────────────
// Slightly outside the period-2 bulb centred at (-1, 0), radius ≈ 0.25
const BULB_R  = 0.285;
const BULB_CX = -1.0;
const BULB_CY =  0.0;
const BULB_LEN = 2 * Math.PI * BULB_R;

function bulbAt(d: number): [number, number] {
  const angle = (((d % BULB_LEN) + BULB_LEN) % BULB_LEN) / BULB_R;
  return [BULB_CX + BULB_R * Math.cos(angle), BULB_CY + BULB_R * Math.sin(angle)];
}

// ── Figure-eight (lemniscate) through Seahorse & cardioid regions ──────────────
// Lemniscate of Bernoulli: x = a·cos(t)/(1+sin²t), y = a·sin(t)·cos(t)/(1+sin²t)
// Offset to straddle Seahorse Valley (≈ −0.75) and the main cardioid (≈ −0.1)
const LEMN_A  = 0.67;
const LEMN_OX = -0.75;
const LEMN_N  = 1000;
const _lP: [number,number][] = Array.from({ length: LEMN_N + 1 }, (_, i) => {
  const t = (2 * Math.PI * i) / LEMN_N;
  const d = 1 + Math.sin(t) * Math.sin(t);
  return [LEMN_OX + LEMN_A * Math.cos(t) / d, LEMN_A * Math.sin(t) * Math.cos(t) / d];
});
const _lDist: number[] = [0];
for (let i = 1; i <= LEMN_N; i++) {
  _lDist.push(_lDist[i-1] + Math.hypot(_lP[i][0]-_lP[i-1][0], _lP[i][1]-_lP[i-1][1]));
}
const LEMN_LEN = _lDist[LEMN_N];

function lemnAt(d: number): [number, number] {
  const target = ((d % LEMN_LEN) + LEMN_LEN) % LEMN_LEN;
  let lo = 0, hi = LEMN_N;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (_lDist[mid] <= target) lo = mid; else hi = mid; }
  const d0 = _lDist[lo], d1 = _lDist[hi];
  const f = d1 === d0 ? 0 : (target - d0) / (d1 - d0);
  return [_lP[lo][0] + f*(_lP[hi][0]-_lP[lo][0]), _lP[lo][1] + f*(_lP[hi][1]-_lP[lo][1])];
}

// ── Scenic Catmull-Rom spline ──────────────────────────────────────────────────
const WAYPOINTS: [number, number][] = [
  [ 0.25,   0.00],
  [ 0.16,   0.03],
  [ 0.05,   0.10],
  [-0.10,   0.22],
  [-0.32,   0.40],
  [-0.55,   0.46],
  [-0.70,   0.34],
  [-0.748,  0.10],
  [-0.79,   0.16],
  [-0.88,   0.06],
  [-1.03,   0.27],
  [-1.22,   0.24],
  [-1.40,   0.05],
  [-1.56,   0.00],
  [-1.76,   0.09],
  [-1.87,   0.02],
  [-1.79,  -0.06],
  [-1.60,  -0.05],
  [-1.38,  -0.04],
  [-1.16,  -0.18],
  [-0.92,  -0.19],
  [-0.76,  -0.11],
  [-0.65,  -0.28],
  [-0.52,  -0.43],
  [-0.30,  -0.57],
  [-0.08,  -0.56],
  [ 0.10,  -0.36],
  [ 0.21,  -0.12],
];

function catmullRom(
  p0: [number,number], p1: [number,number],
  p2: [number,number], p3: [number,number], t: number,
): [number,number] {
  const t2 = t*t, t3 = t2*t;
  return [
    0.5*(2*p1[0]+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
    0.5*(2*p1[1]+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3),
  ];
}

const _sP: [number,number][] = [];
const _wN = WAYPOINTS.length;
for (let i = 0; i < _wN; i++) {
  const p0 = WAYPOINTS[(i-1+_wN)%_wN], p1 = WAYPOINTS[i];
  const p2 = WAYPOINTS[(i+1)%_wN],     p3 = WAYPOINTS[(i+2)%_wN];
  for (let j = 0; j < 64; j++) _sP.push(catmullRom(p0, p1, p2, p3, j/64));
}
const _sDist: number[] = [0];
for (let i = 1; i < _sP.length; i++) {
  _sDist.push(_sDist[i-1] + Math.hypot(_sP[i][0]-_sP[i-1][0], _sP[i][1]-_sP[i-1][1]));
}
const _sClose = Math.hypot(_sP[0][0]-_sP[_sP.length-1][0], _sP[0][1]-_sP[_sP.length-1][1]);
const SCENIC_LEN = _sDist[_sDist.length-1] + _sClose;
const _sLast = _sP.length - 1;

function scenicAt(d: number): [number,number] {
  const target = ((d % SCENIC_LEN) + SCENIC_LEN) % SCENIC_LEN;
  if (target >= _sDist[_sLast]) {
    const f = (target - _sDist[_sLast]) / _sClose;
    return [_sP[_sLast][0]+f*(_sP[0][0]-_sP[_sLast][0]), _sP[_sLast][1]+f*(_sP[0][1]-_sP[_sLast][1])];
  }
  let lo = 0, hi = _sLast;
  while (lo < hi-1) { const mid = (lo+hi)>>1; if (_sDist[mid] <= target) lo = mid; else hi = mid; }
  const f = _sDist[hi]===_sDist[lo] ? 0 : (target-_sDist[lo])/(_sDist[hi]-_sDist[lo]);
  return [_sP[lo][0]+f*(_sP[hi][0]-_sP[lo][0]), _sP[lo][1]+f*(_sP[hi][1]-_sP[lo][1])];
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useAutopilot({
  cx, cy, mandZoom, speed, path, paused, height,
}: {
  cx:       MutableRefObject<number>;
  cy:       MutableRefObject<number>;
  mandZoom: MutableRefObject<number>;
  speed:    number;          // 0 = off, 1–20 = px/sec
  path:     AutopilotPath;
  paused:   boolean;
  height:   number;
}) {
  const speedRef  = useRef(speed);
  const pathRef   = useRef(path);
  const pausedRef = useRef(paused);
  const heightRef = useRef(height);
  useEffect(() => { speedRef.current  = speed;  }, [speed]);
  useEffect(() => { pathRef.current   = path;   }, [path]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { heightRef.current = height; }, [height]);

  const cardDist   = useRef(0);
  const bulbDist   = useRef(0);
  const lemnDist   = useRef(0);
  const scenicDist = useRef(0);

  useEffect(() => {
    let last: number | null = null;
    let raf: number;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (last === null) { last = now; return; }
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      const sp = speedRef.current;
      const pa = pathRef.current;
      if (sp === 0 || pausedRef.current) return;

      // px/sec → Mandelbrot-units/sec at current zoom
      const delta = (sp / (mandZoom.current * heightRef.current * 0.5)) * dt;

      switch (pa) {
        case 'north':
          cy.current += delta;
          if (cy.current > BOUND) cy.current -= 2 * BOUND;
          break;
        case 'south':
          cy.current -= delta;
          if (cy.current < -BOUND) cy.current += 2 * BOUND;
          break;
        case 'east':
          cx.current += delta;
          if (cx.current > BOUND) cx.current -= 2 * BOUND;
          break;
        case 'west':
          cx.current -= delta;
          if (cx.current < -BOUND) cx.current += 2 * BOUND;
          break;
        case 'cardioid': {
          cardDist.current = (cardDist.current + delta) % CARD_LEN;
          const t = cardTAtDist(cardDist.current);
          cx.current = _cX(t);
          cy.current = _cY(t);
          break;
        }
        case 'bulb': {
          bulbDist.current = (bulbDist.current + delta) % BULB_LEN;
          const [bx, by] = bulbAt(bulbDist.current);
          cx.current = bx; cy.current = by;
          break;
        }
        case 'figure8': {
          lemnDist.current = (lemnDist.current + delta) % LEMN_LEN;
          const [lx, ly] = lemnAt(lemnDist.current);
          cx.current = lx; cy.current = ly;
          break;
        }
        case 'scenic': {
          scenicDist.current = (scenicDist.current + delta) % SCENIC_LEN;
          const [sx, sy] = scenicAt(scenicDist.current);
          cx.current = sx; cy.current = sy;
          break;
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}
