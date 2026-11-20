'use client';
import { useEffect, useState } from 'react';
import { useScreener } from '@/context/ScreenerContext';
import { api } from '@/lib/api';
import { fmtScore } from '@/lib/format';

type HistRow = Awaited<ReturnType<typeof api.history>>[number];

// Run history — every completed screener run the backend has saved (newest first).
export default function HistoryPage() {
  const { meta } = useScreener();
  const [history, setHistory] = useState<HistRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .history()
      .then((h) => alive && setHistory(h))
      .catch(() => alive && setHistory([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [meta?.ranAt]);

  return (
    <div className="card">
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Universe</th>
              <th>High Alert</th>
              <th>Watch</th>
              <th>Breakdown</th>
              <th>Avg Score</th>
              <th>Top Score</th>
            </tr>
          </thead>
          <tbody>
            {history.length ? (
              history.map((r, i) => (
                <tr key={r.ranAt}>
                  <td>
                    {new Date(r.ranAt).toLocaleString('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {i === 0 ? <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--green)' }}>● latest</span> : null}
                  </td>
                  <td className="num">{r.universe ?? '—'}</td>
                  <td className="num" style={{ color: 'var(--red)' }}>{r.highAlert}</td>
                  <td className="num" style={{ color: 'var(--amber)' }}>{r.watch}</td>
                  <td className="num">{r.breakdown ?? '—'}</td>
                  <td className="num">{fmtScore(r.avg)}</td>
                  <td className="num" style={{ color: 'var(--green)' }}>{fmtScore(r.top)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ padding: 34, textAlign: 'center', color: 'var(--muted)' }}>
                  {loading ? 'Loading run history…' : 'No completed runs yet. Run the screener to start a history.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
