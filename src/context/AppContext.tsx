import React, {
  createContext,
  MutableRefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AutopilotPath,
  COLOR_SCHEMES,
  ColorScheme,
  INIT_CX,
  INIT_CY,
  INIT_ZOOM,
  JULIA_ZOOM,
  ViewMode,
} from '../constants';

export type AppCtx = {
  // ── Mandelbrot navigation (also the Julia c parameter) ──────────────────────
  cx:       MutableRefObject<number>;
  cy:       MutableRefObject<number>;
  mandZoom: MutableRefObject<number>;

  // ── Julia viewport navigation (JuliaBg + SplitScreen) ────────────────────────
  julCX:   MutableRefObject<number>;
  julCY:   MutableRefObject<number>;
  julZoom: MutableRefObject<number>;

  // ── Color scheme uniforms — written on scheme change, read every GL frame ────
  uPhase: MutableRefObject<[number, number, number]>;
  uFreq:  MutableRefObject<number>;

  // ── Split screen ─────────────────────────────────────────────────────────────
  splitRatio: MutableRefObject<number>;

  // ── Autopilot — locks single-finger Mandelbrot pan for path modes ─────────────
  autopilotPanLocked: MutableRefObject<boolean>;

  // ── React state (triggers UI re-renders) ─────────────────────────────────────
  viewMode:          ViewMode;
  setViewMode:       (v: ViewMode) => void;
  colorScheme:       ColorScheme;
  setColorScheme:    (s: ColorScheme) => void;
  autopilotSpeed:    number;           // 0 = off, 1–20 = px/sec
  setAutopilotSpeed: (s: number) => void;
  autopilotPath:     AutopilotPath;
  setAutopilotPath:  (p: AutopilotPath) => void;
};

const Ctx = createContext<AppCtx>(null!);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const defaultScheme = COLOR_SCHEMES[0];

  const cx        = useRef(INIT_CX);
  const cy        = useRef(INIT_CY);
  const mandZoom  = useRef(INIT_ZOOM);
  const julCX     = useRef(0);
  const julCY     = useRef(0);
  const julZoom   = useRef(JULIA_ZOOM);
  const uPhase    = useRef<[number, number, number]>([...defaultScheme.phase] as [number,number,number]);
  const uFreq     = useRef(defaultScheme.freq);
  const splitRatio = useRef(0.5);
  const autopilotPanLocked = useRef(false);

  const [viewMode, setViewMode]       = useState<ViewMode>('mandelbrot');
  const [colorScheme, _setScheme]     = useState<ColorScheme>(defaultScheme);
  const [autopilotSpeed, setAutopilotSpeed] = useState<number>(0);
  const [autopilotPath,  setAutopilotPath]  = useState<AutopilotPath>('north');

  const setColorScheme = (s: ColorScheme) => {
    uPhase.current = [...s.phase] as [number, number, number];
    uFreq.current  = s.freq;
    _setScheme(s);
  };

  // Keep panLocked ref in sync with speed/path state
  useEffect(() => {
    autopilotPanLocked.current =
      autopilotSpeed > 0 &&
      (autopilotPath === 'cardioid' || autopilotPath === 'scenic' ||
       autopilotPath === 'bulb'     || autopilotPath === 'figure8');
  }, [autopilotSpeed, autopilotPath]);

  return (
    <Ctx.Provider value={{
      cx, cy, mandZoom,
      julCX, julCY, julZoom,
      uPhase, uFreq,
      splitRatio,
      autopilotPanLocked,
      viewMode, setViewMode,
      colorScheme, setColorScheme,
      autopilotSpeed, setAutopilotSpeed,
      autopilotPath,  setAutopilotPath,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
