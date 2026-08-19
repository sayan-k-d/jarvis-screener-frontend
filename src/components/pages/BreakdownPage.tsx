'use client';
import { useMemo } from 'react';
import { useScreener } from '@/context/ScreenerContext';
import { DeltaCell } from '@/components/ui';

export default function BreakdownPage({ onOpenStock }: { onOpenStock: (t: string) => void }) {
  const { rows, liveOn } = useScreener();

  // Stocks flagged as breakdown (netRev<0 & price<sma50), or the weakest tail.
  const list = useMemo(() => {
    const flagged = rows.filter((r) => r.breakdown);
    const base = flagged.length ? flagged : rows.filter((r) => r.sc < 50);
    return base.slice().sort((a, b) => a.sc - b.sc).slice(0, 25);
  }, [rows]);

  const reasons = (r: any): string => {
    const out: string[] = [];
    if (isFinite(r.netRev) && r.netRev < 0) out.push('Negative EPS revisions');
    if (isFinite(r.price) && isFinite(r.sma50) && r.price < r.sma50) out.push('Below 50-day SMA');
    if (isFinite(r.rel30) && r.rel30 < 0) out.push('Lagging S&P (30d)');
    if (isFinite(r.rsi) && r.rsi < 40) out.push('Weak RSI');
    return out.slice(0, 2).join(' · ') || 'Deteriorating momentum';
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>Breakdown Watch</h3>
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
                  <td className="num">{s.sc}</td>
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
