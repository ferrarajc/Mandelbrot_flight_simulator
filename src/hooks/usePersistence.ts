import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppCtx } from '../context/AppContext';
import { COLOR_SCHEMES, ViewMode } from '../constants';

const KEY = 'mfs_v1';

type Handlers = {
  setViewMode:    (v: ViewMode) => void;
  setColorScheme: (s: typeof COLOR_SCHEMES[0]) => void;
};

export function usePersistence(ctx: AppCtx, handlers: Handlers) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted state once on mount
  useEffect(() => {
    AsyncStorage.getItem(KEY).then(raw => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        if (typeof s.cx        === 'number') ctx.cx.current        = s.cx;
        if (typeof s.cy        === 'number') ctx.cy.current        = s.cy;
        if (typeof s.mandZoom  === 'number') ctx.mandZoom.current  = s.mandZoom;
        if (typeof s.julCX     === 'number') ctx.julCX.current     = s.julCX;
        if (typeof s.julCY     === 'number') ctx.julCY.current     = s.julCY;
        if (typeof s.julZoom   === 'number') ctx.julZoom.current   = s.julZoom;
        if (typeof s.splitRatio === 'number') ctx.splitRatio.current = s.splitRatio;
        if (s.viewMode) handlers.setViewMode(s.viewMode as ViewMode);
        if (s.colorSchemeId) {
          const scheme = COLOR_SCHEMES.find(c => c.id === s.colorSchemeId);
          if (scheme) handlers.setColorScheme(scheme);
        }
      } catch {}
    });
  }, []);

  const save = (viewMode: ViewMode, colorSchemeId: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const data = {
        cx:           ctx.cx.current,
        cy:           ctx.cy.current,
        mandZoom:     ctx.mandZoom.current,
        julCX:        ctx.julCX.current,
        julCY:        ctx.julCY.current,
        julZoom:      ctx.julZoom.current,
        splitRatio:   ctx.splitRatio.current,
        viewMode,
        colorSchemeId,
      };
      AsyncStorage.setItem(KEY, JSON.stringify(data));
    }, 800);
  };

  return { save };
}
