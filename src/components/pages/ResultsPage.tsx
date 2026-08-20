"use client";
import { useMemo, useState, useEffect } from "react";
import { useScreener } from "@/context/ScreenerContext";
import { DeltaCell, TierBadge } from "@/components/ui";
import { InfoTip, FORMULAS } from "@/components/InfoTip";

const PER = 10;

export default function ResultsPage({
  onOpenStock,
}: {
  onOpenStock: (t: string) => void;
}) {
  const {
    rows,
    meta,
    liveOn,
    loading,
    error,
    progress,
    runLive,
    hasKey,
    loadLast,
  } = useScreener();
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("");
  const [sector, setSector] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState("rank");
  const [tierPill, setTierPill] = useState("All");
  const [page, setPage] = useState(1);

  // Load the last persisted run when arriving, if we don't have data yet.
  useEffect(() => {
    if (!rows.length && !loading) loadLast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sectors = useMemo(
    () => [...new Set(rows.map((s) => s.s).filter(Boolean))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let out = rows.filter(
      (s) =>
        (!ql ||
          s.t.toLowerCase().includes(ql) ||
          (s.n || "").toLowerCase().includes(ql)) &&
        (!tier || s.tier === tier) &&
        (!sector || s.s === sector) &&
        s.sc >= minScore &&
        (tierPill === "All" || s.tier === tierPill),
    );
    const cmp: Record<string, (a: any, b: any) => number> = {
      score: (a, b) => b.sc - a.sc,
      delta: (a, b) => b.d - a.d,
      ticker: (a, b) => a.t.localeCompare(b.t),
      company: (a, b) => (a.n || "").localeCompare(b.n || ""),
    };
    return out.slice().sort(cmp[sort] || ((a, b) => a.r - b.r));
  }, [rows, q, tier, sector, minScore, sort, tierPill]);

  const tierCounts = useMemo(() => {
    const c: Record<string, number> = {
      All: rows.length,
      "High Alert": 0,
      Watch: 0,
      "Breakdown Watch": 0,
      Neutral: 0,
    };
    rows.forEach((s) => {
      if (c[s.tier] !== undefined) c[s.tier]++;
    });
    return c;
  }, [rows]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const curPage = Math.min(Math.max(1, page), pages);
  const slice = filtered.slice((curPage - 1) * PER, curPage * PER);

  const reset = () => {
    setQ("");
    setTier("");
    setSector("");
    setMinScore(0);
    setSort("rank");
    setTierPill("All");
    setPage(1);
  };

  const exportCsv = () => {
    const head = [
      "Rank",
      "Ticker",
      "Company",
      "Sector",
      "Score",
      "Delta",
      "Tier",
      "Confluence",
    ];
    const lines = [head.join(",")].concat(
      filtered.map((s) =>
        [
          s.r,
          s.t,
          `"${(s.n || "").replace(/"/g, '""')}"`,
          s.s,
          s.sc,
          Math.round(s.d || 0),
          s.tier,
          s.conf ? "Yes" : "No",
        ].join(","),
      ),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jarvis-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const win: number[] = [];
  for (
    let i = Math.max(1, curPage - 2);
    i <= Math.min(pages, Math.max(5, curPage + 2)) && win.length < 5;
    i++
  )
    win.push(i);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>Weekly Screener Results</h3>
          <div className="sub">
            {liveOn && meta
              ? `Live run: ${new Date(meta.ranAt).toLocaleString()}`
              : hasKey === false
                ? "No API key configured on the server"
                : "Not yet run"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <button
            className="btn"
            onClick={exportCsv}
            disabled={!filtered.length}
          >
            ⭳ Export
          </button>
          <button
            className="btn solid"
            onClick={runLive}
            disabled={loading || hasKey === false}
          >
            {loading ? "Running…" : liveOn ? "Re-run" : "Run Screener"}
          </button>
        </div>
      </div>

      {/* progress bar */}
      {loading && progress && (
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "var(--muted)",
              marginBottom: 7,
            }}
          >
            <span>{progress.label}</span>
            <span>
              {progress.done}/{progress.total} (
              {progress.total
                ? Math.round((progress.done / progress.total) * 100)
                : 0}
              %)
            </span>
          </div>
          <div
            style={{
              height: 8,
              background: "var(--line-soft)",
              borderRadius: 99,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                background: "var(--blue)",
                transition: "width .3s",
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px 18px",
            color: "var(--red)",
            fontSize: 12.5,
            borderBottom: "1px solid var(--line)",
          }}
        >
          {error}
        </div>
      )}

      {/* toolbar */}
      <div className="toolbar">
        <input
          className="inp"
          placeholder="Search by ticker or company"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="sel"
          value={tier}
          onChange={(e) => {
            setTier(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Tiers</option>
          {["High Alert", "Watch", "Neutral", "Weakening", "Deteriorating"].map(
            (t) => (
              <option key={t}>{t}</option>
            ),
          )}
        </select>
        <select
          className="sel"
          value={sector}
          onChange={(e) => {
            setSector(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Sectors</option>
          {sectors.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className="sel"
          value={minScore}
          onChange={(e) => {
            setMinScore(+e.target.value);
            setPage(1);
          }}
        >
          {[0, 30, 50, 70, 85].map((v) => (
            <option key={v} value={v}>
              {v === 0 ? "Score: All" : `Score ≥ ${v}`}
            </option>
          ))}
        </select>
        <select
          className="sel"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="rank">Sort: Rank</option>
          <option value="score">Sort: Score</option>
          <option value="delta">Sort: Δ vs Prior</option>
          <option value="ticker">Sort: Ticker</option>
          <option value="company">Sort: Company</option>
        </select>
        <button className="btn" onClick={reset}>
          Reset
        </button>
      </div>

      {/* tier pills */}
      {liveOn && (
        <div className="pills">
          {Object.entries(tierCounts).map(([k, v]) => (
            <button
              key={k}
              className={`pill ${tierPill === k ? "active" : ""}`}
              onClick={() => {
                setTierPill(k);
                setPage(1);
              }}
            >
              {k} ({v.toLocaleString()})
            </button>
          ))}
        </div>
      )}

      {/* table */}
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Ticker</th>
            <th>Company</th>
            <th>Sector</th>
            <th>
              Score
              <InfoTip label="Composite Score" text={FORMULAS.composite} />
            </th>
            <th>
              Δ vs Prior
              <InfoTip label="Weekly Delta" text={FORMULAS.delta} />
            </th>
            <th>
              Tier
              <InfoTip label="Tier" text={FORMULAS.tier} />
            </th>
            <th>
              Triple Confluence
              <InfoTip label="Triple Confluence" text={FORMULAS.conf} />
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && !slice.length ? (
            <tr>
              <td
                colSpan={8}
                style={{
                  padding: 48,
                  textAlign: "center",
                  color: "var(--muted)",
                }}
              >
                <span className="spin" />
                <div style={{ marginTop: 12, fontSize: 12.5 }}>
                  Loading live screener data…
                </div>
              </td>
            </tr>
          ) : slice.length ? (
            slice.map((s) => (
              <tr key={s.t}>
                <td className="num">{s.r}</td>
                <td className="tkr" onClick={() => onOpenStock(s.t)}>
                  {s.t}
                </td>
                <td>{s.n}</td>
                <td style={{ color: "var(--muted)" }}>{s.s}</td>
                <td className="num">{s.sc}</td>
                <td>
                  <DeltaCell d={s.d} isNew={s.isNew} />
                </td>
                <td>
                  <TierBadge tier={s.tier} />
                </td>
                <td>
                  {s.conf ? (
                    <span className="star">★</span>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={8}
                style={{
                  padding: 34,
                  textAlign: "center",
                  color: "var(--muted)",
                }}
              >
                {rows.length
                  ? "No stocks match these filters. Widen the score range, clear the search, or press Reset."
                  : hasKey === false
                    ? "The server has no Alpha Vantage API key configured. Set AV_API_KEY in the backend .env."
                    : "Press “Run Screener” to fetch and score the universe live."}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* pager */}
      {!!slice.length && (
        <div className="pager">
          <div className="pgs">
            <button
              className="pg"
              disabled={curPage === 1}
              onClick={() => setPage(curPage - 1)}
            >
              ‹
            </button>
            {win.map((i) => (
              <button
                key={i}
                className={`pg ${i === curPage ? "active" : ""}`}
                onClick={() => setPage(i)}
              >
                {i}
              </button>
            ))}
            {pages > win[win.length - 1] && (
              <>
                <span style={{ alignSelf: "center", color: "var(--muted)" }}>
                  …
                </span>
                <button className="pg" onClick={() => setPage(pages)}>
                  {pages}
                </button>
              </>
            )}
            <button
              className="pg"
              disabled={curPage === pages}
              onClick={() => setPage(curPage + 1)}
            >
              ›
            </button>
          </div>
          <div>
            Showing {filtered.length ? (curPage - 1) * PER + 1 : 0} to{" "}
            {(curPage - 1) * PER + slice.length} of{" "}
            {filtered.length.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
