'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { adaptRow, fmtCap, fmtBig, pct, qLabel, parseNews, sentimentBand, relTime } from '@/lib/format';
import { TierBadge } from '@/components/ui';
import { PriceChart, Sparkline } from '@/components/Charts';

const GROUP_META: [string, string, number][] = [
  ['A', 'Price & Relative Strength Momentum', 29],
  ['B', 'Forward Earnings Estimate Momentum', 28],
  ['C', 'Business Quality & ROIC', 23],
  ['D', 'Valuation Discipline', 12],
  ['E', 'Revenue & Operating Momentum', 8],
];
const FACTOR_LABELS: Record<string, string> = {
  f1: '1-Month Return vs S&P 500', f2: '10-Day Return vs S&P 500', f3: 'YTD Return vs S&P 500', f4: 'Relative Strength Index (RSI)',
  f5: 'EPS Next-Year Change %', f6: 'EPS Revisions Up (30d)', f7: 'EPS Revisions Down (30d)',
  f8: 'ROIC', f9: 'Net Margin', f10: 'EPS Surprise %',
  f11: 'EV / EBITDA', f12: 'Price / FCF', f13: 'Trailing P/E',
  f14: 'Revenue Growth YoY', f15: 'Operating Margin TTM',
};
const GROUP_FACTORS: Record<string, string[]> = {
  A: ['f1', 'f2', 'f3', 'f4'], B: ['f5', 'f6', 'f7'], C: ['f8', 'f9', 'f10'], D: ['f11', 'f12', 'f13'], E: ['f14', 'f15'],
};
const TABS = [
  ['overview', 'Overview'],
  ['factors', 'Factors'],
  ['financials', 'Financials'],
  ['gates', 'Risk Gates'],
  ['news', 'News'],
  ['chart', 'Chart'],
];

function scoreColor(v: number) {
  return v >= 85 ? 'var(--green)' : v >= 70 ? 'var(--amber)' : v >= 50 ? 'var(--blue)' : 'var(--red)';
}

export default function DetailPage({ ticker }: { ticker: string }) {
  const [dtab, setDtab] = useState('overview');
  const [payload, setPayload] = useState<any>(null);
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [factorView, setFactorView] = useState('Factor Groups');
  const [openG, setOpenG] = useState<string | null>('A');
  const [news, setNews] = useState<{ items: any[]; avg: number } | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setNews(null);
    api
      .detail(ticker)
      .then((res) => {
        if (!alive) return;
        setPayload(res.payload);
        setRow(res.scored ? adaptRow(res.scored) : null);
        if (!res.scored) setError(`No usable data returned for ${ticker}.`);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [ticker]);

  // Lazy-load news when the News tab opens.
  useEffect(() => {
    if (dtab === 'news' && !news && !newsLoading) {
      setNewsLoading(true);
      api
        .news(ticker)
        .then((j) => setNews(parseNews(j, ticker)))
        .catch(() => setNews({ items: [], avg: NaN }))
        .finally(() => setNewsLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dtab]);

  if (loading)
    return (
      <div className="card card-pad" style={{ textAlign: 'center', padding: 60 }}>
        <span className="spin" />
        <div style={{ marginTop: 12, color: 'var(--muted)', fontSize: 12.5 }}>Loading {ticker}…</div>
      </div>
    );
  if (error && !row)
    return <div className="card card-pad" style={{ color: 'var(--muted)' }}>{error}</div>;
  if (!row) return null;

  const dv = Math.round(row.d || 0);

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ background: 'var(--navy)', color: 'var(--ink)', padding: '5px 11px', borderRadius: 6, fontWeight: 800, fontSize: 17, border: '1px solid var(--line)' }}>
                  {row.t}
                </span>
                <span style={{ fontSize: 19, fontWeight: 700 }}>{row.n}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 9 }}>
                {row.s} &gt; {row.ind}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <TierBadge tier={row.tier} />
              {row.conf ? <div className="star" style={{ fontSize: 11.5, fontWeight: 600, marginTop: 8 }}>★ Triple Confluence</div> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Composite Score</div>
          <div style={{ fontSize: 44, fontWeight: 800, marginTop: 10, letterSpacing: '-.03em' }}>
            {row.sc}
            <span style={{ fontSize: 15, color: 'var(--muted)', fontWeight: 600 }}>/100</span>
          </div>
        </div>
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Weekly Delta</div>
          <div style={{ fontSize: 36, fontWeight: 800, marginTop: 12, color: row.isNew ? '#f2c94c' : Math.abs(dv) <= 2 ? 'var(--muted)' : dv > 0 ? 'var(--green)' : 'var(--red)' }}>
            {row.isNew ? 'NEW' : `${Math.abs(dv) <= 2 ? '— ' : dv > 0 ? '▲ ' : '▼ '}${Math.abs(dv) <= 2 ? (dv >= 0 ? '+' : '') + dv : Math.abs(dv)}`}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 8 }}>{row.isNew ? 'first appearance' : 'vs last run'}</div>
        </div>
        <div className="card card-pad">
          {[['Price', row.priceStr], ['Market Cap', row.capStr], ['Sector', row.s], ['Industry', row.ind]].map(([k, v], i) => (
            <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 12, borderBottom: i < 3 ? '1px solid var(--line-soft)' : 'none' }}>
              <span style={{ color: 'var(--muted)' }}>{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={`tab ${dtab === id ? 'active' : ''}`} onClick={() => setDtab(id)}>
              {label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {dtab === 'overview' && (
          <>
            <div className="grid g2 card-pad">
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Group Scores</div>
                {GROUP_META.map(([id, name, w]) => {
                  const val = row[`sub${id}`];
                  return (
                    <div key={id} style={{ marginBottom: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                        <span>{name}</span>
                        <b>{val}</b>
                      </div>
                      <div style={{ height: 7, background: 'var(--line-soft)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${val}%`, height: '100%', background: scoreColor(val), borderRadius: 5 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Score History</div>
                <Sparkline data={row.hist} w={260} h={90} />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Composite trend (last 8 runs, modeled)</div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--line)' }} className="card-pad">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Key Stats</div>
              <div className="grid g4">
                {[
                  ['52W High', row.hiStr], ['52W Low', row.loStr], ['Beta', row.betaStr], ['Volume', row.volStr],
                  ['ROIC', row.roicStr], ['EV/EBITDA', row.evStr], ['P/FCF', row.pfcfStr], ['Trailing P/E', row.peStr],
                ].map(([k, v]) => (
                  <div key={k as string} style={{ background: 'var(--card-2)', borderRadius: 8, padding: '11px 13px' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>{k}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 5 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* FACTORS */}
        {dtab === 'factors' && (
          <>
            <div className="toolbar" style={{ borderBottom: 0, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>View by</span>
                <select className="sel" value={factorView} onChange={(e) => setFactorView(e.target.value)}>
                  <option>Factor Groups</option>
                  <option>All Factors</option>
                </select>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>All scores are percentile ranks (0–100)</span>
            </div>
            <div style={{ padding: '0 18px 18px' }}>
              {factorView === 'Factor Groups'
                ? GROUP_META.map(([id, name, w]) => {
                    const val = row[`sub${id}`];
                    const open = openG === id;
                    return (
                      <div key={id} style={{ border: '1px solid var(--line)', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
                        <div
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 15px', cursor: 'pointer', background: 'var(--card-2)' }}
                          onClick={() => setOpenG(open ? null : id)}
                        >
                          <div>
                            <span style={{ display: 'inline-grid', placeItems: 'center', width: 22, height: 22, borderRadius: 5, background: scoreColor(val), color: '#fff', fontWeight: 800, fontSize: 11, marginRight: 10 }}>{id}</span>
                            <b style={{ fontSize: 13 }}>{name}</b>
                            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>Group Weight: {w}%</span>
                          </div>
                          <b style={{ fontSize: 15 }}>{val}<span style={{ fontSize: 11, color: 'var(--muted)' }}> /100</span></b>
                        </div>
                        {open && (
                          <div style={{ padding: '4px 15px 12px' }}>
                            {GROUP_FACTORS[id].map((fid) => (
                              <div key={fid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                                <span style={{ fontSize: 12 }}>{FACTOR_LABELS[fid]}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ width: 90, height: 6, background: 'var(--line-soft)', borderRadius: 4, overflow: 'hidden' }}>
                                    <span style={{ display: 'block', width: `${Math.round(row.factors[fid])}%`, height: '100%', background: scoreColor(row.factors[fid]) }} />
                                  </span>
                                  <b style={{ fontSize: 12, width: 26, textAlign: 'right' }}>{Math.round(row.factors[fid])}</b>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                : (
                  <div style={{ marginTop: 8 }}>
                    {Object.keys(FACTOR_LABELS).map((fid) => (
                      <div key={fid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--line-soft)' }}>
                        <span style={{ fontSize: 12.5 }}>{FACTOR_LABELS[fid]}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 120, height: 6, background: 'var(--line-soft)', borderRadius: 4, overflow: 'hidden' }}>
                            <span style={{ display: 'block', width: `${Math.round(row.factors[fid])}%`, height: '100%', background: scoreColor(row.factors[fid]) }} />
                          </span>
                          <b style={{ fontSize: 12, width: 26, textAlign: 'right' }}>{Math.round(row.factors[fid])}</b>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </>
        )}

        {/* FINANCIALS */}
        {dtab === 'financials' && <Financials payload={payload} row={row} />}

        {/* RISK GATES */}
        {dtab === 'gates' && <Gates row={row} />}

        {/* NEWS */}
        {dtab === 'news' && (
          <div className="card-pad">
            {newsLoading ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 24, fontSize: 12.5 }}>
                <span className="spin" style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Loading news &amp; sentiment…
              </div>
            ) : news && news.items.length ? (
              <NewsList news={news} sym={ticker} />
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: 16 }}>No recent news returned for {ticker}.</div>
            )}
          </div>
        )}

        {/* CHART */}
        {dtab === 'chart' && (
          <div className="card-pad">
            <PriceChart closes={payload?.closes || []} />
          </div>
        )}
      </div>
    </>
  );
}

function Financials({ payload, row }: { payload: any; row: any }) {
  const q = (payload?.quarters || []).slice().reverse();
  const stats = [
    ['Market Cap', fmtCap(row.marketCap)],
    ['Trailing P/E', row.peStr],
    ['ROIC', row.roicStr],
    ['EV/EBITDA', row.evStr],
    ['P/FCF', row.pfcfStr],
    ['Beta', row.betaStr],
    ['52W High', row.hiStr],
    ['52W Low', row.loStr],
  ];
  const rows: [string, (x: any) => string][] = [
    ['Revenue', (x) => fmtBig(x.revenue)],
    ['Gross Margin', (x) => (isFinite(x.grossMargin) ? (x.grossMargin * 100).toFixed(1) + '%' : '—')],
    ['Operating Income', (x) => fmtBig(x.operatingIncome)],
    ['Net Income', (x) => fmtBig(x.netIncome)],
    ['EPS', (x) => (isFinite(x.eps) ? '$' + x.eps.toFixed(2) : '—')],
  ];
  return (
    <div className="card-pad">
      <div className="grid g4">
        {stats.map(([k, v]) => (
          <div key={k} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 13px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>{k}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 5 }}>{v}</div>
          </div>
        ))}
      </div>
      {q.length ? (
        <div style={{ overflowX: 'auto', marginTop: 18 }}>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                {q.map((x: any) => (
                  <th key={x.end} style={{ textAlign: 'right' }}>{qLabel(x.end)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, fn]) => (
                <tr key={label}>
                  <td style={{ fontWeight: 600 }}>{label}</td>
                  {q.map((x: any, i: number) => (
                    <td key={i} className="num" style={{ textAlign: 'right' }}>{fn(x)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: 16 }}>Quarterly financials not available.</div>
      )}
    </div>
  );
}

function Gates({ row }: { row: any }) {
  const all = row.gatesPassed !== false;
  return (
    <>
      <div className="card-head" style={{ borderTop: 0 }}>
        <div>
          <h3>Risk Gates</h3>
          <div className="sub">All gates must pass to be eligible</div>
        </div>
        <span className={`badge ${all ? 'b-ok' : 'b-break'}`}>{all ? 'ALL PASSED' : 'GATE FAILED'}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Gate</th>
            <th>Status</th>
            <th>Value</th>
            <th>Threshold</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {(row.gates || []).map((g: any) => (
            <tr key={g.name}>
              <td>{g.name}</td>
              <td>
                <span className={`badge ${g.pass ? 'b-pass' : 'b-break'}`}>{g.pass ? '⊙ PASS' : '⊗ FAIL'}</span>
              </td>
              <td className="num">{g.value}</td>
              <td style={{ color: 'var(--muted)' }}>{g.threshold}</td>
              <td style={{ color: 'var(--muted)' }}>{g.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        style={{
          margin: '16px 18px 18px',
          padding: '12px 14px',
          background: all ? 'var(--green-bg)' : 'var(--red-bg)',
          border: `1px solid ${all ? '#1f4a34' : '#4a2226'}`,
          borderRadius: 8,
          fontSize: 12,
          color: all ? 'var(--green)' : '#ff8a8e',
        }}
      >
        {all
          ? '⊙ This stock passes all risk gates and is eligible for the screener results.'
          : `⊗ A risk gate failed — composite is capped at ${row.scoreCap}. Cannot appear in HIGH ALERT or WATCH.`}
      </div>
    </>
  );
}

function NewsList({ news, sym }: { news: { items: any[]; avg: number }; sym: string }) {
  const band = sentimentBand(news.avg);
  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>AGGREGATE NEWS SENTIMENT</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{news.items.length} recent articles · Alpha Vantage</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`senti ${band.cls}`} style={{ fontSize: 12 }}>{band.label}</span>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>avg score {isFinite(news.avg) ? news.avg.toFixed(3) : '—'}</div>
        </div>
      </div>
      {news.items.map((a, i) => {
        const b = sentimentBand(a.score);
        const sc = isFinite(a.score) ? (a.score >= 0 ? '+' : '') + a.score.toFixed(2) : '—';
        return (
          <div key={i} style={{ padding: '13px 0', borderTop: i ? '1px solid var(--line-soft)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, flex: 1 }}>
                {a.title}
              </a>
              <span className={`senti ${b.cls}`}>
                {b.label} {sc}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
              {[a.source, relTime(a.time)].filter(Boolean).join(' · ')}
              {isFinite(a.relevance) ? ` · relevance ${(a.relevance * 100).toFixed(0)}%` : ''}
            </div>
            {a.summary ? (
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.5 }}>
                {a.summary.length > 220 ? a.summary.slice(0, 220) + '…' : a.summary}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
