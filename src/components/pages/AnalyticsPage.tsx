'use client';
import { useMemo } from 'react';
import { useScreener } from '@/context/ScreenerContext';

export default function AnalyticsPage() {
  const { rows, meta, liveOn } = useScreener();

  const dist = useMemo(() => {
    const buckets = [
      ['80–100', 80, 100],
      ['60–79', 60, 79],
      ['40–59', 40, 59],
      ['20–39', 20, 39],
      ['0–19', 0, 19],
    ] as [string, number, number][];
    return buckets.map(([l, lo, hi]) => [l, rows.filter((r) => r.sc >= lo && r.sc <= hi).length] as [string, number]);
  }, [rows]);
  const maxDist = Math.max(1, ...dist.map((d) => d[1]));

  const sectors = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      if (r.s) m[r.s] = (m[r.s] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const maxSec = Math.max(1, ...sectors.map((s) => s[1]));

  const avg = meta?.avgComposite ? meta.avgComposite.toFixed(1) : rows.length ? (rows.reduce((s, r) => s + r.sc, 0) / rows.length).toFixed(1) : '—';
  const top = rows.length ? Math.max(...rows.map((r) => r.sc)) : '—';

  return (
    <>
      <div className="grid g3" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="k" style={{ color: 'var(--muted)' }}>Stocks Scored</div>
          <div className="v">{rows.length.toLocaleString()}</div>
          <div className="d">{liveOn ? 'This run' : 'Run to populate'}</div>
        </div>
        <div className="stat">
          <div className="k" style={{ color: 'var(--muted)' }}>Average Composite</div>
          <div className="v">{avg}</div>
          <div className="d">Across scored stocks</div>
        </div>
        <div className="stat">
          <div className="k" style={{ color: 'var(--muted)' }}>Top Score</div>
          <div className="v" style={{ color: 'var(--green)' }}>{top}</div>
          <div className="d">Highest composite</div>
        </div>
      </div>
      <div className="grid g2">
        <div className="card">
          <div className="card-head">
            <h3>Score Distribution</h3>
          </div>
          <div className="card-pad">
            {dist.map(([l, v]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ width: 56, fontSize: 11.5, color: 'var(--muted)' }}>{l}</span>
                <div style={{ flex: 1, height: 18, background: 'var(--line-soft)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${(v / maxDist) * 100}%`, height: '100%', background: 'var(--blue)', borderRadius: 5 }} />
                </div>
                <b style={{ width: 30, textAlign: 'right', fontSize: 12 }}>{v}</b>
              </div>
            ))}
            {!rows.length && <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Run the screener to see distribution.</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Sector Breakdown</h3>
          </div>
          <div className="card-pad">
            {sectors.length ? (
              sectors.map(([l, v]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 11 }}>
                  <span style={{ width: 120, fontSize: 11.5, color: 'var(--muted)' }}>{l}</span>
                  <div style={{ flex: 1, height: 16, background: 'var(--line-soft)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${(v / maxSec) * 100}%`, height: '100%', background: 'var(--green)', borderRadius: 5 }} />
                  </div>
                  <b style={{ width: 26, textAlign: 'right', fontSize: 12 }}>{v}</b>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Run the screener to see sectors.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
