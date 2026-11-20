'use client';
import { useMemo } from 'react';
import { useScreener } from '@/context/ScreenerContext';
import { DeltaCell } from '@/components/ui';
import { fmtScore } from '@/lib/format';

export default function BreakdownPage({ onOpenStock }: { onOpenStock: (t: string) => void }) {
  const { rows, liveOn } = useScreener();

  // Spec: BREAKDOWN WATCH = net negative EPS revisions AND price below 50D SMA
  // (regardless of score); DETERIORATING (score < 30) is the separate alert list.
  const list = useMemo(() => {
    const base = rows.filter((r) => r.breakdown || r.tier === 'Deteriorating');
    return base.slice().sort((a, b) => a.sc - b.sc).slice(0, 25);
  }, [rows]);

  const reasons = (r: any): string => {
    const out: string[] = [];
    if (isFinite(r.netRev) && r.netRev < 0) out.push('Negative EPS revisions');
    if (isFinite(r.price) && isFinite(r.sma50) && r.price < r.sma50) out.push('Below 50-day SMA');
    if (isFinite(r.rel30) && r.rel30 < 0) out.push('Lagging S&P (30d)');
    if (isFinite(r.rsi) && r.rsi < 40) out.push('Weak RSI');
    if (r.tier === 'Deteriorating') out.unshift('Score < 30');
    return out.slice(0, 2).join(' · ') || 'Deteriorating momentum';
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>Watchlists & Alerts</h3>
          <div className="sub">Stocks with deteriorating momentum</div>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Company</th>
              <th>Score</th>
              <th>Δ (vs Prior)</th>
              <th>Top Reasons</th>
            </tr>
          </thead>
          <tbody>
            {list.length ? (
              list.map((s) => (
                <tr key={s.t}>
                  <td className="tkr red" style={{ color: 'var(--red)', cursor: 'pointer' }} onClick={() => onOpenStock(s.t)}>
                    {s.t}
                  </td>
                  <td>{s.n}</td>
                  <td className="num">{fmtScore(s.sc)}</td>
                  <td>
                    <DeltaCell d={s.d} isNew={s.isNew} />
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{reasons(s)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ padding: 34, textAlign: 'center', color: 'var(--muted)' }}>
                  {liveOn ? 'No breakdown-watch stocks in the latest run.' : 'Run the screener to populate breakdown watch.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
