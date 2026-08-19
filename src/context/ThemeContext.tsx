'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

type Mode = 'dark' | 'light';
interface ThemeCtx {
  mode: Mode;
  toggle: () => void;
  setMode: (m: Mode) => void;
  ready: boolean;
}
const Ctx = createContext<ThemeCtx>({ mode: 'dark', toggle: () => {}, setMode: () => {}, ready: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>('dark');
  const [ready, setReady] = useState(false);

  // Load the persisted theme (server-side JSON file) on mount.
  useEffect(() => {
    let alive = true;
    api
      .getTheme()
      .then((r) => {
        if (alive) setModeState(r.mode === 'light' ? 'light' : 'dark');
      })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  // Reflect on <html data-theme> so CSS variables switch.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', mode);
    }
  }, [mode]);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    api.setTheme(m).catch(() => {}); // persist server-side; ignore failures
  }, []);
  const toggle = useCallback(() => setMode(mode === 'dark' ? 'light' : 'dark'), [mode, setMode]);

  return <Ctx.Provider value={{ mode, toggle, setMode, ready }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
