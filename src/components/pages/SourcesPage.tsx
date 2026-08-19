'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Data-source health. The Alpha Vantage row reflects the real server key status.
export default function SourcesPage() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  useEffect(() => {
    api
      .status()
      .then((s) => {
        setHasKey(s.hasKey);
        setLastRunAt(s.lastRunAt);
      })
      .catch(() => setHasKey(false));
  }, []);

  const refresh = lastRunAt ? new Date(lastRunAt).toLocaleString() : '—';
  const sources: [string, boolean, string, string][] = [
    ['Alpha Vantage — Fundamentals', hasKey !== false, refresh, hasKey === false ? 'No API key configured on server' : 'OVERVIEW / INCOME / BALANCE / CASH_FLOW'],
    ['Alpha Vantage — Prices (Daily)', hasKey !== false, refresh, 'TIME_SERIES_DAILY + SMA(50)'],
    ['Alpha Vantage — Estimates', hasKey !== false, refresh, 'EARNINGS_ESTIMATES (EPS/revenue)'],
    ['Alpha Vantage — News Sentiment', hasKey !== false, refresh, 'NEWS_SENTIMENT feed'],
    ['S&P 500 Benchmark (SPY)', hasKey !== false, refresh, 'Relative-strength baseline'],
    ['Scoring Engine', true, refresh, 'BuildSpec v2 — 15 factors / 5 groups'],
  ];

  const allOk = hasKey !== false;

  return (
    <div className="card">
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Data Source</th>
              <th>Status</th>
              <th>Last Refresh</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {sources.map(([name, ok, when, note]) => (
              <tr key={name}>
                <td style={{ fontWeight: 600 }}>{name}</td>
                <td>
                  <span className={`badge ${ok ? 'b-ok' : 'b-break'}`}>{ok ? '● Operational' : '● Down'}</span>
                </td>
                <td style={{ color: 'var(--muted)' }}>{when}</td>
                <td style={{ color: 'var(--muted)' }}>{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '14px 18px', borderTop: '1px solid var(--line)', fontSize: 12, color: allOk ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
        {allOk ? '● All systems operational' : '● Alpha Vantage key missing — set AV_API_KEY in the backend .env'}
      </div>
    </div>
  );
}
