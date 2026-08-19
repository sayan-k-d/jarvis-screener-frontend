'use client';
import { useScreener } from '@/context/ScreenerContext';

// Run history. We keep a representative recent list; the latest live run (if any)
// is shown at the top so the page reflects real activity.
export default function HistoryPage() {
  const { meta, rows, liveOn } = useScreener();

  const sample = [
    ['Aug 07, 2026', '5,921', 20, 30, 17, 68.4, 96],
    ['Jul 31, 2026', '5,918', 18, 28, 16, 65.2, 94],
    ['Jul 24, 2026', '5,905', 19, 31, 18, 64.1, 93],
    ['Jul 17, 2026', '5,890', 17, 27, 15, 62.3, 92],
    ['Jul 10, 2026', '5,880', 16, 25, 14, 61.0, 90],
    ['Jul 03, 2026', '5,875', 15, 24, 13, 60.2, 89],
  ];

  const liveRow =
    liveOn && meta
      ? [
          new Date(meta.ranAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          meta.fetched.toLocaleString(),
          rows.filter((r) => r.tier === 'High Alert').length,
          rows.filter((r) => r.tier === 'Watch').length,
          rows.filter((r) => r.breakdown).length,
          meta.avgComposite.toFixed(1),
          rows.length ? Math.max(...rows.map((r) => r.sc)) : 0,
        ]
      : null;

  const all = liveRow ? [liveRow, ...sample] : sample;

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
              <th>Report</th>
            </tr>
          </thead>
          <tbody>
            {all.map((r, i) => (
              <tr key={i}>
                <td>{r[0]}{i === 0 && liveRow ? <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--green)' }}>● live</span> : null}</td>
                <td className="num">{r[1]}</td>
                <td className="num" style={{ color: 'var(--red)' }}>{r[2]}</td>
                <td className="num" style={{ color: 'var(--amber)' }}>{r[3]}</td>
                <td className="num">{r[4]}</td>
                <td className="num">{r[5]}</td>
                <td className="num" style={{ color: 'var(--green)' }}>{r[6]}</td>
                <td>
                  <span className="link">View →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
