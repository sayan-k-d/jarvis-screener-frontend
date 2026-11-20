"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type ActivityEvent, type DashboardSummary, type Usage } from "@/lib/api";
import { ICONS, type PageId } from "@/lib/nav";
import { fmtScore } from "@/lib/format";
import { Donut, TrendChart } from "@/components/Charts";
import { InfoTip } from "@/components/InfoTip";

type HistRow = Awaited<ReturnType<typeof api.history>>[number];

// ---------------------------------------------------------------- formatting
const fmtMs = (ms: number | null | undefined): string => {
  if (typeof ms !== "number" || !isFinite(ms)) return "—";
  if (ms < 1000) return "<1s";
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};
const fmtPct = (v: number | null | undefined): string =>
  typeof v === "number" && isFinite(v) ? `${Math.round(v)}%` : "—";
const fmtInt = (v: number | null | undefined): string =>
  typeof v === "number" && isFinite(v) ? v.toLocaleString() : "—";
const rel = (iso: string | null | undefined): string => {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const rateTone = (v: number | null): Tone => (v === null ? "" : v >= 95 ? "good" : v >= 80 ? "warn" : "bad");

type Tone = "" | "good" | "warn" | "bad";

// ----------------------------------------------------------------- building blocks
function Kpi({ label, value, sub, tone = "", tip }: { label: string; value: string; sub?: string; tone?: Tone; tip?: string }) {
  return (
    <div className="db-kpi">
      <div className="db-kpi-l">
        {label}
        {tip && <InfoTip label={label} text={tip} />}
      </div>
      <div className={`db-kpi-v ${tone}`}>{value}</div>
      {sub && <div className="db-kpi-s">{sub}</div>}
    </div>
  );
}

function Spark({ data, noun }: { data: number[]; noun: string }) {
  const max = Math.max(...data, 1);
  const total = data.reduce((a, b) => a + b, 0);
  return (
    <div className="db-spark-wrap">
      <div className="db-spark" aria-hidden="true">
        {data.map((v, i) => (
          <i key={i} className={v ? "on" : ""} style={{ height: `${v ? Math.max(14, (v / max) * 100) : 8}%` }} />
        ))}
      </div>
      <span className="db-spark-c">{total ? `${total} ${noun} in the last 7 days` : `No ${noun} in the last 7 days`}</span>
    </div>
  );
}

function Module({
  id,
  title,
  desc,
  chip,
  chipTone = "",
  onOpen,
  children,
  foot,
}: {
  id: string;
  title: string;
  desc: string;
  chip?: string;
  chipTone?: Tone;
  onOpen: () => void;
  children: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <section className="card db-mod" aria-label={title}>
      <header className="db-mod-h">
        <span className="db-ic" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[id] || "" }} />
        </span>
        <div className="db-mod-t">
          <h3>{title}</h3>
          <p>{desc}</p>
        </div>
        {chip && <span className={`db-chip ${chipTone}`}>{chip}</span>}
        <button className="db-open" onClick={onOpen} aria-label={`Open ${title}`}>
          Open <span aria-hidden="true">→</span>
        </button>
      </header>
      <div className="db-mod-b">{children}</div>
      {foot && <footer className="db-mod-f">{foot}</footer>}
    </section>
  );
}

function Chips({ items, empty }: { items: { item: string; count: number }[]; empty: string }) {
  if (!items.length) return <span className="db-muted">{empty}</span>;
  return (
    <div className="db-chips">
      <span className="db-muted">Most used</span>
      {items.map((t) => (
        <span key={t.item} className="db-tk">
          {t.item}
          <small>{t.count}</small>
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------- activity feed
function describe(e: ActivityEvent): { icon: string; text: string; meta: string } {
  const who = (e.items || []).join(", ");
  const took = e.ms ? fmtMs(e.ms) : "";
  switch (e.kind) {
    case "screener_run":
      return {
        icon: "results",
        text: e.ok ? `Weekly screener run — ${fmtInt(e.n)} stocks scored` : "Weekly screener run failed",
        meta: [took, e.detail].filter(Boolean).join(" · "),
      };
    case "stock_analysis":
      return {
        icon: "stock_analysis",
        text: e.ok ? `Researched ${who || "a stock"}` : `Research failed for ${who || "a stock"}`,
        meta: [e.cached ? "saved result" : took, !e.ok ? e.detail : ""].filter(Boolean).join(" · "),
      };
    case "compare":
      return {
        icon: "compare",
        text: e.ok ? `Loaded ${who || "a stock"} into Compare` : `Compare failed for ${who || "a stock"}`,
        meta: [e.cached ? "saved result" : took, !e.ok ? e.detail : ""].filter(Boolean).join(" · "),
      };
    case "research_compare":
      return {
        icon: "researchLibrary",
        text: e.ok ? `Compared two reports${e.n ? ` — ${e.n} pages read` : ""}` : "Report comparison failed",
        meta: [took, !e.ok ? e.detail : ""].filter(Boolean).join(" · "),
      };
    default:
      return {
        icon: "researchLibrary",
        text: e.ok ? "Asked a question about a comparison" : "A question could not be answered",
        meta: [took, !e.ok ? e.detail : ""].filter(Boolean).join(" · "),
      };
  }
}

function Feed({ events }: { events: ActivityEvent[] }) {
  if (!events.length)
    return (
      <div className="db-empty">
        Nothing recorded yet. As screener runs, research, comparisons and report analyses happen, they appear here
        with how long they took.
      </div>
    );
  return (
    <ul className="db-feed">
      {events.map((e, i) => {
        const d = describe(e);
        return (
          <li key={i} className={e.ok ? "" : "bad"}>
            <span className="db-feed-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[d.icon] || "" }} />
            </span>
            <div className="db-feed-t">
              <div>{d.text}</div>
              {d.meta && <small>{d.meta}</small>}
            </div>
            <span className="db-feed-r">
              <span className={`db-dot ${e.ok ? "good" : "bad"}`} title={e.ok ? "Succeeded" : "Failed"} />
              {rel(e.t)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ----------------------------------------------------------------------- page
export default function DashboardPage({
  onNav,
  onOpenStock,
}: {
  onNav: (id: PageId) => void;
  onOpenStock: (t: string) => void;
}) {
  const [d, setD] = useState<DashboardSummary | null>(null);
  const [history, setHistory] = useState<HistRow[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([api.dashboard(), api.history().catch(() => [] as HistRow[])]);
      setD(s);
      setHistory(h);
      setErr("");
    } catch (e) {
      setErr((e as Error).message || "Could not load the dashboard.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    const vis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [load]);

  const trend = useMemo(() => {
    const h = history.slice(0, 8).reverse();
    return {
      labels: h.map((r) => fmtShort(r.ranAt)),
      series: [
        { n: "High Alert", c: "#1668e3", d: h.map((r) => r.highAlert) },
        { n: "Watch", c: "#3ddc84", d: h.map((r) => r.watch) },
        { n: "Breakdown", c: "#e03131", d: h.map((r) => r.breakdown ?? 0) },
      ],
    };
  }, [history]);

  const dist = useMemo((): [string, number, string][] => {
    const t = d?.screener.tiers;
    return [
      ["85–100  High Alert", t?.highAlert ?? 0, "#1668e3"],
      ["70–85  Watch", t?.watch ?? 0, "#3b8ef0"],
      ["50–70  Neutral", t?.neutral ?? 0, "#f2b705"],
      ["30–50  Weakening", t?.weakening ?? 0, "#f08c3b"],
      ["0–30  Deteriorating", t?.deteriorating ?? 0, "#e03131"],
    ];
  }, [d]);

  if (!d) {
    return (
      <div className="db">
        <style>{CSS}</style>
        {err ? (
          <div className="card db-pad">
            <div className="db-banner bad" role="alert">{err}</div>
            <button className="btn solid" style={{ marginTop: 14 }} onClick={() => { setLoading(true); load(); }}>
              Try again
            </button>
          </div>
        ) : (
          <div aria-busy="true" aria-label="Loading dashboard">
            <div className="db-skel" style={{ height: 54 }} />
            <div className="db-grid4" style={{ margin: "14px 0" }}>
              {[0, 1, 2, 3].map((i) => <div key={i} className="db-skel" style={{ height: 96 }} />)}
            </div>
            <div className="db-grid2">
              {[0, 1, 2, 3].map((i) => <div key={i} className="db-skel" style={{ height: 250 }} />)}
            </div>
          </div>
        )}
      </div>
    );
  }

  const s = d.screener;
  const w = d.watchlist;
  const lib = d.library;
  const age = s.ageHours;
  const freshTone: Tone = !s.hasRun ? "warn" : age !== null && age > 24 * 8 ? "warn" : "good";
  const freshText = d.services.screenerRunning
    ? "Run in progress"
    : !s.hasRun
      ? "No run yet"
      : age !== null && age > 24 * 8
        ? `Stale — ran ${Math.floor(age / 24)} days ago`
        : `Fresh — ran ${rel(s.lastRunAt)}`;

  const weekActions =
    s.runs.last7d +
    d.stockResearch.last7d +
    d.compare.last7d +
    lib.byDay.reduce((a, b) => a + b, 0) +
    lib.questionUsage.last7d;

  const usageEmpty = (u: Usage) => u.total === 0;

  return (
    <div className="db">
      <style>{CSS}</style>

      {/* system status */}
      <div className="card db-status" role="status">
        <div className="db-status-row">
          <span className={`db-pill ${d.services.screenerData ? "good" : "bad"}`}>
            <span className="db-dot" /> Market data {d.services.screenerData ? "connected" : "not configured"}
          </span>
          <span className={`db-pill ${d.services.ai ? "good" : "bad"}`}>
            <span className="db-dot" /> AI service {d.services.ai ? `ready · ${d.services.aiModel}` : "not configured"}
          </span>
          <span className={`db-pill ${freshTone}`}>
            <span className="db-dot" /> Weekly screener: {freshText}
          </span>
        </div>
        <div className="db-status-row" style={{ marginLeft: "auto" }}>
          <span className="db-muted">Updated {new Date(d.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
          <button className="btn" onClick={() => { setLoading(true); load(); }} disabled={loading} style={{ padding: "6px 12px" }}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      {err && <div className="db-banner bad" role="alert" style={{ marginTop: 12 }}>Could not refresh: {err}</div>}

      {/* headline numbers */}
      <div className="db-grid4" style={{ marginTop: 14 }}>
        <div className="card db-hero">
          <div className="db-hero-l">Stocks scored</div>
          <div className="db-hero-v">{fmtInt(s.scored)}</div>
          <div className="db-hero-s">{s.hasRun ? `of ${s.universe} in the last run` : "Run the weekly screener to populate"}</div>
        </div>
        <div className="card db-hero">
          <div className="db-hero-l">Priority names</div>
          <div className="db-hero-v">{fmtInt(s.tiers.highAlert + s.tiers.watch)}</div>
          <div className="db-hero-s">{s.tiers.highAlert} High Alert · {s.tiers.watch} Watch</div>
        </div>
        <div className="card db-hero">
          <div className="db-hero-l">Flagged for attention</div>
          <div className={`db-hero-v ${w.totalFlagged ? "warn" : ""}`}>{fmtInt(w.totalFlagged)}</div>
          <div className="db-hero-s">Breakdown Watch and Deteriorating</div>
        </div>
        <div className="card db-hero">
          <div className="db-hero-l">Actions this week</div>
          <div className="db-hero-v">{fmtInt(weekActions)}</div>
          <div className="db-hero-s">Runs, research, comparisons and Q&amp;A</div>
        </div>
      </div>

      {/* modules */}
      <div className="db-grid2" style={{ marginTop: 14 }}>
        <Module
          id="results"
          title="Weekly Screener"
          desc="How the latest scan went and what it found"
          chip={s.hasRun ? `Ran ${rel(s.lastRunAt)}` : "No run yet"}
          chipTone={freshTone}
          onOpen={() => onNav("results")}
          foot={
            s.top.length ? (
              <div className="db-top">
                <div className="db-label">Highest scores</div>
                {s.top.map((t, i) => (
                  <button key={t.t} className="db-toprow" onClick={() => onOpenStock(t.t)}>
                    <span className="db-rank">{i + 1}</span>
                    <b className="db-tkr">{t.t}</b>
                    <span className="db-nm">{t.name}</span>
                    <span className={`db-tier ${t.tier === "High Alert" || t.tier === "Watch" ? "good" : ""}`}>{t.tier}</span>
                    <b className="db-sc">{fmtScore(t.score)}</b>
                  </button>
                ))}
              </div>
            ) : (
              <span className="db-muted">No results yet — open the Weekly Screener and run it.</span>
            )
          }
        >
          <div className="db-kpis three">
            <Kpi label="Stocks scored" value={fmtInt(s.scored)} sub={`of ${s.universe} · ${s.failures} failed`} tone={s.failures ? "warn" : ""} tip="How many stocks received a score in the latest run, and how many could not be fetched." />
            <Kpi label="Average score" value={s.avgScore === null ? "—" : fmtScore(s.avgScore)} sub={s.topScore === null ? undefined : `top ${fmtScore(s.topScore)}`} tip="The mean Jarvis score across every stock scored in the latest run." />
            <Kpi label="High Alert · Watch" value={`${s.tiers.highAlert} · ${s.tiers.watch}`} sub="priority names" tip="Stocks with the strongest overall scores." />
            <Kpi label="Triple Confluence" value={fmtInt(s.confluence)} sub="all 3 signals aligned" tip="Stocks where earnings expectations, price trend and sales growth are all moving the right way together." />
            <Kpi label="Growth criterion" value={fmtInt(s.gatePassed)} sub={`of ${s.universe} meet >10%`} tip="Stocks whose expected revenue growth next year is above 10%." />
            <Kpi label="Last run took" value={fmtMs(s.durationMs)} sub={s.runs.total ? `${s.runs.total} runs · ${fmtPct(s.runs.successRate)} succeeded` : `${s.savedRuns} saved run${s.savedRuns === 1 ? "" : "s"}`} tip="How long the most recent full scan took to fetch and score every stock." />
          </div>
        </Module>

        <Module
          id="stock_analysis"
          title="Stock Research"
          desc="Company analyses requested and how they performed"
          chip={d.stockResearch.lastAt ? `Last ${rel(d.stockResearch.lastAt)}` : "No activity yet"}
          onOpen={() => onNav("stock_analysis")}
          foot={
            <>
              <Spark data={d.stockResearch.byDay} noun="analyses" />
              <Chips items={d.stockResearch.topItems} empty="Researched tickers will appear here." />
            </>
          }
        >
          <div className="db-kpis">
            <Kpi label="Analyses run" value={fmtInt(d.stockResearch.total)} sub={`${d.stockResearch.last7d} in the last 7 days`} tip="Total company analyses opened from Stock Research, including saved results." />
            <Kpi label="Success rate" value={fmtPct(d.stockResearch.successRate)} tone={rateTone(d.stockResearch.successRate)} sub={usageEmpty(d.stockResearch) ? "no data yet" : "finished without errors"} tip="Share of analyses that completed successfully." />
            <Kpi label="Avg turnaround" value={fmtMs(d.stockResearch.avgMs)} sub="fresh analyses only" tip="Average time for a new analysis to complete. Saved results open instantly and are not counted." />
            <Kpi label="Saved results used" value={fmtPct(d.stockResearch.cacheHitRate)} sub="opened instantly" tip="Share of analyses served from a previously saved result instead of running again." />
          </div>
        </Module>

        <Module
          id="compare"
          title="Compare"
          desc="Stocks loaded into side-by-side comparisons"
          chip={d.compare.lastAt ? `Last ${rel(d.compare.lastAt)}` : "No activity yet"}
          onOpen={() => onNav("compare")}
          foot={
            <>
              <Spark data={d.compare.byDay} noun="stock loads" />
              <Chips items={d.compare.topItems} empty="Compared tickers will appear here." />
            </>
          }
        >
          <div className="db-kpis">
            <Kpi label="Stocks loaded" value={fmtInt(d.compare.total)} sub={`${d.compare.last7d} in the last 7 days`} tip="Number of stocks scored for the Compare page, including saved results." />
            <Kpi label="Unique tickers" value={fmtInt(d.compare.uniqueItems)} sub="different companies" tip="How many different companies have been compared." />
            <Kpi label="Success rate" value={fmtPct(d.compare.successRate)} tone={rateTone(d.compare.successRate)} sub={usageEmpty(d.compare) ? "no data yet" : "loaded without errors"} tip="Share of stock loads that completed successfully." />
            <Kpi label="Avg load time" value={fmtMs(d.compare.avgMs)} sub={`${fmtPct(d.compare.cacheHitRate)} from saved results`} tip="Average time to score a stock that was not already saved." />
          </div>
        </Module>

        <Module
          id="breakdown"
          title="Watchlists & Alerts"
          desc="Names showing signs of deterioration"
          chip={w.totalFlagged ? `${w.totalFlagged} flagged` : "All clear"}
          chipTone={w.totalFlagged ? "warn" : "good"}
          onOpen={() => onNav("breakdown")}
          foot={
            w.flagged.length ? (
              <div className="db-top">
                <div className="db-label">Weakest flagged names</div>
                {w.flagged.map((t) => (
                  <button key={t.t} className="db-toprow" onClick={() => onOpenStock(t.t)}>
                    <b className="db-tkr">{t.t}</b>
                    <span className="db-nm">{t.reason}</span>
                    <b className="db-sc bad">{fmtScore(t.score)}</b>
                  </button>
                ))}
              </div>
            ) : (
              <span className="db-muted">{s.hasRun ? "No stocks are currently flagged." : "Run the weekly screener to check for alerts."}</span>
            )
          }
        >
          <div className="db-kpis">
            <Kpi label="Breakdown Watch" value={fmtInt(w.breakdown)} tone={w.breakdown ? "warn" : ""} sub="estimates cut + below 50-day avg" tip="Stocks where analysts are cutting earnings estimates and the price is below its 50-day average." />
            <Kpi label="Deteriorating" value={fmtInt(w.deteriorating)} tone={w.deteriorating ? "bad" : ""} sub="score below 30" tip="Stocks with the weakest overall scores." />
            <Kpi label="Weakening" value={fmtInt(w.weakening)} sub="score 30–50" tip="Stocks whose overall score has slipped into the weak range." />
            <Kpi label="Total flagged" value={fmtInt(w.totalFlagged)} sub="needing a look" tip="Stocks on the Breakdown Watch or Deteriorating lists." />
          </div>
        </Module>

        <Module
          id="researchLibrary"
          title="Research Library"
          desc="Report comparisons and the questions asked about them"
          chip={lib.last ? `Last ${rel(lib.last.at)}` : "No reports yet"}
          chipTone={lib.failed ? "warn" : ""}
          onOpen={() => onNav("researchLibrary")}
          foot={
            <>
              <Spark data={lib.byDay} noun="comparisons" />
              {lib.last ? (
                <div className="db-last">
                  <span className="db-muted">Latest</span> {lib.last.title}
                </div>
              ) : (
                <span className="db-muted">Upload two reports to start your library.</span>
              )}
            </>
          }
        >
          <div className="db-kpis">
            <Kpi label="Comparisons saved" value={fmtInt(lib.total)} sub={`${lib.ready} ready${lib.failed ? ` · ${lib.failed} failed` : ""}${lib.processing ? ` · ${lib.processing} running` : ""}`} tone={lib.failed ? "warn" : ""} tip="Report comparisons kept in the library." />
            <Kpi label="Questions asked" value={fmtInt(lib.questions)} sub={lib.total ? `across ${lib.total} comparison${lib.total === 1 ? "" : "s"}` : "no comparisons yet"} tip="Questions asked in the Q&A panels across every saved comparison." />
            <Kpi label="Pages analysed" value={fmtInt(lib.pages)} sub="from ready comparisons" tip="Total report pages read and compared." />
            <Kpi label="Avg analysis time" value={fmtMs(lib.avgMs)} sub={lib.successRate === null ? undefined : `${fmtPct(lib.successRate)} succeeded`} tone="" tip="Average time to read, analyse and compare a pair of reports." />
          </div>
        </Module>

        <section className="card db-mod" aria-label="Score distribution">
          <header className="db-mod-h">
            <div className="db-mod-t">
              <h3>Score distribution</h3>
              <p>Where the latest run's stocks sit by tier</p>
            </div>
          </header>
          <div className="db-mod-b" style={{ paddingTop: 6 }}>
            <Donut segs={dist} />
            <div className="db-muted" style={{ marginTop: 14 }}>
              {s.spy7d === null ? "" : `S&P 500 (SPY) 7-day return: ${s.spy7d >= 0 ? "+" : ""}${s.spy7d.toFixed(1)}%`}
            </div>
          </div>
        </section>
      </div>

      {/* trends + activity */}
      <div className="db-grid2" style={{ marginTop: 14 }}>
        <section className="card db-mod" aria-label="Trend of top tiers">
          <header className="db-mod-h">
            <div className="db-mod-t">
              <h3>Weekly signal history</h3>
              <p>High Alert, Watch and Breakdown counts per saved run</p>
            </div>
          </header>
          <div className="db-mod-b">
            <TrendChart labels={trend.labels} series={trend.series} />
          </div>
          <footer className="db-mod-f" style={{ display: "block", padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>High Alert</th>
                  <th>Watch</th>
                  <th>Breakdown</th>
                  <th>Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {history.length ? (
                  history.slice(0, 5).map((r) => (
                    <tr key={r.ranAt}>
                      <td>{new Date(r.ranAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</td>
                      <td className="num">{r.highAlert}</td>
                      <td className="num">{r.watch}</td>
                      <td className="num">{r.breakdown ?? "—"}</td>
                      <td className="num">{fmtScore(r.avg)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: 22, textAlign: "center", color: "var(--muted)" }}>No completed runs yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </footer>
        </section>

        <section className="card db-mod" aria-label="Recent activity">
          <header className="db-mod-h">
            <div className="db-mod-t">
              <h3>Recent activity</h3>
              <p>The latest actions across every module</p>
            </div>
          </header>
          <div className="db-mod-b" style={{ padding: 0 }}>
            <Feed events={d.recent} />
          </div>
        </section>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- styles
const CSS = `
.db{display:block;color:var(--ink)}
.db *{box-sizing:border-box}
.db h3,.db p{margin:0}
.db-muted{color:var(--muted);font-size:12.5px}
.db-pad{padding:20px}
.db-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.db-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@media (max-width:1180px){.db-grid2{grid-template-columns:1fr}}
@media (max-width:1000px){.db-grid4{grid-template-columns:repeat(2,1fr)}}
@media (max-width:520px){.db-grid4{grid-template-columns:1fr}}
.db-status{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 16px}
.db-status-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.db-pill{display:inline-flex;align-items:center;gap:8px;padding:5px 12px;border-radius:999px;font-size:12.5px;font-weight:600;border:1px solid var(--line);background:var(--card-2);color:var(--ink-2)}
.db-pill.good{background:var(--green-bg);border-color:transparent;color:var(--green)}
.db-pill.warn{background:var(--amber-bg);border-color:transparent;color:var(--amber)}
.db-pill.bad{background:var(--red-bg);border-color:transparent;color:var(--red)}
.db-dot{width:8px;height:8px;border-radius:50%;background:currentColor;display:inline-block;flex:none}
.db-dot.good{background:var(--green)}.db-dot.bad{background:var(--red)}
.db-banner{padding:11px 14px;border-radius:9px;font-size:13px;border:1px solid}
.db-banner.bad{background:var(--red-bg);border-color:var(--red)}
.db-hero{padding:16px 18px}
.db-hero-l{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.db-hero-v{font-size:32px;font-weight:800;letter-spacing:-.03em;margin-top:6px;line-height:1.1}
.db-hero-v.warn{color:var(--amber)}
.db-hero-s{font-size:12.5px;color:var(--muted);margin-top:6px}
.db-mod{display:flex;flex-direction:column;min-width:0}
.db-mod-h{display:flex;align-items:center;gap:12px;padding:16px 18px 6px;flex-wrap:wrap}
.db-ic{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:var(--card-2);border:1px solid var(--line);color:var(--blue);flex:none}
.db-ic svg,.db-feed-ic svg{width:19px;height:19px}
.db-mod-t{flex:1;min-width:150px}
.db-mod-t h3{font-size:15px;font-weight:700;letter-spacing:-.01em}
.db-mod-t p{font-size:12.5px;color:var(--muted);margin-top:2px}
.db-chip{font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:999px;background:var(--card-2);border:1px solid var(--line);color:var(--ink-2);white-space:nowrap}
.db-chip.good{background:var(--green-bg);border-color:transparent;color:var(--green)}
.db-chip.warn{background:var(--amber-bg);border-color:transparent;color:var(--amber)}
.db-open{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:6px 12px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.db-open:hover{background:var(--btn-hover)}
.db-open:focus-visible,.db-toprow:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
.db-mod-b{padding:12px 18px 16px}
.db-mod-f{display:flex;flex-direction:column;gap:10px;padding:14px 18px 16px;border-top:1px solid var(--line-soft);margin-top:auto;min-height:62px;justify-content:center}
.db-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.db-kpis.three{grid-template-columns:repeat(3,1fr)}
@media (max-width:560px){.db-kpis.three{grid-template-columns:repeat(2,1fr)}}
.db-kpi{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--card-2);min-width:0}
.db-kpi-l{font-size:11.5px;font-weight:700;color:var(--muted);letter-spacing:.02em}
.db-kpi-v{font-size:24px;font-weight:800;letter-spacing:-.02em;margin-top:5px;line-height:1.15}
.db-kpi-v.good{color:var(--green)}.db-kpi-v.warn{color:var(--amber)}.db-kpi-v.bad{color:var(--red)}
.db-kpi-s{font-size:11.5px;color:var(--muted);margin-top:4px;line-height:1.35}
.db-spark-wrap{display:flex;align-items:flex-end;gap:12px}
.db-spark{display:flex;align-items:flex-end;gap:4px;height:34px;width:96px;flex:none}
.db-spark i{flex:1;background:var(--line);border-radius:3px}
.db-spark i.on{background:var(--blue)}
.db-spark-c{font-size:12px;color:var(--muted);padding-bottom:2px}
.db-chips{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
.db-tk{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;border:1px solid var(--line);font-size:12px;font-weight:700;background:var(--card-2)}
.db-tk small{color:var(--muted);font-weight:600}
.db-last{font-size:13px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.db-label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.db-top{display:flex;flex-direction:column;gap:2px}
.db-toprow{display:flex;align-items:center;gap:10px;width:100%;padding:7px 8px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.db-toprow:hover{background:var(--row-hover)}
.db-rank{width:18px;color:var(--muted);font-size:12px;font-weight:700}
.db-tkr{min-width:52px;color:var(--blue)}
.db-nm{flex:1;min-width:0;color:var(--ink-2);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.db-tier{font-size:11px;font-weight:700;color:var(--muted);white-space:nowrap}
.db-tier.good{color:var(--green)}
.db-sc{min-width:48px;text-align:right}
.db-sc.bad{color:var(--red)}
.db-feed{list-style:none;margin:0;padding:6px 8px 10px;display:flex;flex-direction:column}
.db-feed li{display:flex;gap:12px;align-items:center;padding:10px;border-radius:9px}
.db-feed li:hover{background:var(--row-hover)}
.db-feed-ic{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:var(--card-2);border:1px solid var(--line);color:var(--blue);flex:none}
.db-feed li.bad .db-feed-ic{color:var(--red)}
.db-feed-t{flex:1;min-width:0;font-size:13.5px;line-height:1.35}
.db-feed-t small{display:block;color:var(--muted);font-size:11.5px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.db-feed-r{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted);white-space:nowrap}
.db-empty{padding:34px 22px;text-align:center;color:var(--muted);font-size:13px;line-height:1.6}
.db-skel{border-radius:12px;background:linear-gradient(90deg,var(--card-2),var(--line-soft),var(--card-2));background-size:200% 100%;animation:db-sh 1.4s infinite}
@keyframes db-sh{from{background-position:200% 0}to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.db-skel{animation:none}}
`;
