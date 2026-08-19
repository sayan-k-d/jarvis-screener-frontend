'use client';
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { api, runScreenerStream, RunMeta } from '@/lib/api';
import { adaptRow, AdaptedRow } from '@/lib/format';

interface ScreenerState {
  rows: AdaptedRow[];
  meta: RunMeta | null;
  hadPriorRun: boolean;
  liveOn: boolean;
  loading: boolean;
  tried: boolean;
  error: string;
  progress: { done: number; total: number; label: string } | null;
  hasKey: boolean | null;
  loadLast: () => Promise<void>;
  runLive: () => void;
  checkStatus: () => Promise<void>;
}

const Ctx = createContext<ScreenerState>({} as ScreenerState);

export function ScreenerProvider({ children }: { children: React.ReactNode }) {
  const [rows, setRows] = useState<AdaptedRow[]>([]);
  const [meta, setMeta] = useState<RunMeta | null>(null);
  const [hadPriorRun, setHadPriorRun] = useState(false);
  const [liveOn, setLiveOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const cancelRef = useRef<null | (() => void)>(null);

  const checkStatus = useCallback(async () => {
    try {
      const s = await api.status();
      setHasKey(s.hasKey);
    } catch {
      setHasKey(false);
    }
  }, []);

  const applyResult = useCallback((result: { rows: any[]; meta: RunMeta; hadPriorRun: boolean }) => {
    const adapted = (result.rows || []).map((r) => adaptRow(r));
    setRows(adapted);
    setMeta(result.meta);
    setHadPriorRun(result.hadPriorRun);
    setLiveOn(true);
  }, []);

  const loadLast = useCallback(async () => {
    try {
      const last = await api.lastRun();
      if (last?.rows?.length) applyResult(last as any);
    } catch {
      /* ignore */
    }
  }, [applyResult]);

  const runLive = useCallback(() => {
    setTried(true);
    setError('');
    setLoading(true);
    setProgress({ done: 0, total: 1, label: 'Starting…' });
    cancelRef.current?.();
    cancelRef.current = runScreenerStream({
      onProgress: (done, total, label) => setProgress({ done, total, label }),
      onDone: (result) => {
        applyResult(result);
        setLoading(false);
        setProgress(null);
      },
      onError: (message) => {
        setError(message);
        setLoading(false);
        setProgress(null);
      },
    });
  }, [applyResult]);

  return (
    <Ctx.Provider
      value={{
        rows, meta, hadPriorRun, liveOn, loading, tried, error, progress, hasKey,
        loadLast, runLive, checkStatus,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useScreener = () => useContext(Ctx);
