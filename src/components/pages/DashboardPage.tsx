'use client';
import { useMemo } from 'react';
import { useScreener } from '@/context/ScreenerContext';
import { Donut, TrendChart } from '@/components/Charts';

export default function DashboardPage() {
  const { rows, meta, liveOn } = useScreener();

  const stats = useMemo(() => {
    const count = (t: string) => rows.filter((r) => r.tier === t).length;
    return {
      universe: meta?.universeN ?? rows.length,
      highAlert: count('High Alert'),
      watch: count('Watch'),
      breakdown: rows.filter((r) => r.breakdown).length,
      avg: meta?.avgComposite ? meta.avgComposite.toFixed(1) : rows.length ? (rows.reduce((s, r) => s + r.sc, 0) / rows.length).toFixed(1) : '—',
      spyWeek: isFinite(meta?.spy?.ret30) ? (meta!.spy.ret30 >= 0 ? '+' : '') + meta!.spy.ret30.toFixed(1) + '%' : '—',
    };
  }, [rows, meta]);

  const recent = [
    ['Aug 07, 2026', 20, 30, 17, 68.4],
    ['Jul 31, 2026', 18, 28, 16, 65.2],
    ['Jul 24, 2026', 19, 31, 18, 64.1],
    ['Jul 17, 2026', 17, 27, 15, 62.3],
    ['Jul 10, 2026', 16, 25, 14, 61.0],
  ];

  return (
    <>
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="k k-blue">Universe Scanned</div>
          <div className="v">{stats.universe.toLocaleString()}</div>
          <div className="d">{liveOn ? 'Fetched this run' : 'Large-cap universe'}</div>
        </div>
        <div className="stat">
          <div className="k k-red">High Alert</div>
          <div className="v" style={{ color: 'var(--red)' }}>{stats.highAlert}</div>
          <div className="d">Top momentum</div>
        </div>
        <div className="stat">
          <div className="k k-amber">Watch</div>
          <div className="v" style={{ color: 'var(--amber)' }}>{stats.watch}</div>
          <div className="d">Strong momentum</div>
        </div>
        <div className="stat">
          <div className="k k-red">Breakdown Watch</div>
          <div className="v" style={{ color: 'var(--red)' }}>{stats.breakdown}</div>
          <div className="d">Deteriorating</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1.15fr', marginBottom: 14 }}>
        <div className="stat">
          <div className="k" style={{ color: 'var(--muted)' }}>Average Composite Score</div>
          <div className="v">{stats.avg}</div>
          <div className="d">{liveOn ? 'Across scored stocks' : 'Run to populate'}</div>
        </div>
        <div className="stat">
          <div className="k" style={{ color: 'var(--muted)' }}>Market Return (30D)</div>
          <div className="v" style={{ color: 'var(--green)' }}>{stats.spyWeek}</div>
          <div className="d">S&amp;P 500 (SPY)</div>
        </div>
        <div className="card">
          <div className="card-pad" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Score Distribution</div>
            <Donut />
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        <div className="card">
          <div className="card-head">
            <h3>Trend of Top Tiers</h3>
          </div>
          <div className="card-pad">
            <TrendChart />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Recent Runs</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>High Alert</th>
                <th>Watch</th>
                <th>Breakdown</th>
                <th>Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r[0] as string}>
                  <td>{r[0]}</td>
                  <td className="num" style={{ color: 'var(--red)' }}>{r[1]}</td>
                  <td className="num" style={{ color: 'var(--amber)' }}>{r[2]}</td>
                  <td className="num">{r[3]}</td>
                  <td className="num">{r[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
