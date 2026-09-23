"use client";
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { api, runScreenerStream, RunMeta } from "@/lib/api";
import { adaptRow, AdaptedRow } from "@/lib/format";

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
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    label: string;
  } | null>(null);
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

  const applyResult = useCallback(
    (result: { rows: any[]; meta: RunMeta; hadPriorRun: boolean }) => {
      const adapted = (result.rows || []).map((r) => adaptRow(r));
      setRows(adapted);
      if (result.meta) setMeta(result.meta);
      setHadPriorRun(!!result.hadPriorRun);
      setLiveOn(true);
    },
    [],
  );

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
    setError("");
    setLoading(true);
    // Seed with the real universe size so the bar never shows "/1". status()
    // has usually populated hasKey by now; if universeSize is unknown we fall
    // back to 70 (the default universe) and the first progress event corrects it.
    setProgress({ done: 0, total: 70, label: "Starting…" });
    cancelRef.current?.();
    cancelRef.current = runScreenerStream({
      onProgress: (done, total, label) =>
        setProgress({ done, total: total || 70, label }),
      // Render each re-ranked snapshot as it arrives — same code path as a
      // finished run, so the table fills in continuously instead of staying
      // blank until the whole universe is done.
      onPartial: (result) => applyResult(result),
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
        rows,
        meta,
        hadPriorRun,
        liveOn,
        loading,
        tried,
        error,
        progress,
        hasKey,
        loadLast,
        runLive,
        checkStatus,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useScreener = () => useContext(Ctx);
