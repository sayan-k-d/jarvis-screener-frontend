"use client";
import { useState } from "react";
import { researchApi, type DocAnalysis, type ResearchRecord } from "@/lib/researchApi";
import AskPanel from "./AskPanel";
import { Icon, Prose, fmtBytes, fmtTime, stripPdf } from "./ui";

type Tab = "overview" | "differences" | "metrics" | "reports";

const COMPARABILITY: Record<string, string> = {
  high: "High comparability",
  medium: "Medium comparability",
  low: "Low comparability",
};

function Bullets({ items, empty = "Nothing notable reported." }: { items: string[]; empty?: string }) {
  if (!items?.length) return <p className="rl-sub" style={{ marginTop: 8 }}>{empty}</p>;
  return (
    <ul className="rl-list-ul">
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  );
}

function ReportCard({ tone, name, a }: { tone: "a" | "b"; name: string; a: DocAnalysis }) {
  return (
    <div className={`rl-box ${tone}`} style={{ background: "var(--card)" }}>
      <div className="rl-row" style={{ gap: 8, marginBottom: 6 }}>
        <span className={`rl-tag ${tone}`}>Report {tone.toUpperCase()}</span>
        <span className="rl-sub">{stripPdf(name)}</span>
      </div>
      <h4 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.4 }}>{a.entity !== "Unknown" ? a.entity : a.title}</h4>
      <div className="rl-sub" style={{ marginTop: 2 }}>
        {[a.report_type, a.period].filter((x) => x && x !== "N/A").join(" · ")}
      </div>
      <p style={{ marginTop: 12, lineHeight: 1.65, color: "var(--ink-2)", fontSize: 14.5 }}>{a.summary}</p>

      {!!a.key_figures.length && (
        <>
          <div className="rl-label" style={{ marginTop: 16 }}>Key figures</div>
          <div className="rl-kf">
            {a.key_figures.map((k, i) => (
              <div key={i}>
                <span>{k.label}</span>
                <b>{k.value}</b>
                <span>
                  {k.context}
                  {k.page ? ` · p.${k.page}` : ""}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="rl-label" style={{ marginTop: 16 }}>Highlights</div>
      <Bullets items={a.highlights} />
      <div className="rl-label" style={{ marginTop: 16 }}>Risks and concerns</div>
      <Bullets items={a.risks} />
      <div className="rl-label" style={{ marginTop: 16 }}>Outlook</div>
      <p style={{ marginTop: 6, lineHeight: 1.6, color: "var(--ink-2)" }}>{a.outlook}</p>
      {!!a.themes.length && (
        <div className="rl-themes">
          {a.themes.map((t) => (
            <span key={t} className="rl-theme">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResultView({
  rec,
  onBack,
  onDelete,
}: {
  rec: ResearchRecord;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const c = rec.comparison!;
  const [an, bn] = rec.analyses!;
  const [da, db] = rec.docs;
  const truncated = da.truncated || db.truncated;

  const tabs: [Tab, string, number?][] = [
    ["overview", "Overview"],
    ["differences", "Key differences", c.key_differences.length],
    ["metrics", "Metrics", c.metrics.length],
    ["reports", "Report summaries"],
  ];

  return (
    <div className="rl">
      <div className="rl-spread">
        <button className="rl-btn" onClick={onBack}>
          <Icon name="back" /> Library
        </button>
        <button className="rl-btn danger" onClick={onDelete}>
          <Icon name="trash" /> Delete
        </button>
      </div>

      {/* header */}
      <div className="card">
        <div className="rl-pad">
          <div className="rl-sub" style={{ marginBottom: 6 }}>
            Compared {fmtTime(rec.createdAt)} · {rec.model}
            {rec.focus ? ` · Focus: ${rec.focus}` : ""}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.3 }}>{rec.title}</h2>
          <div className="rl-row" style={{ marginTop: 14, gap: 12 }}>
            {(
              [
                ["a", da],
                ["b", db],
              ] as const
            ).map(([t, d]) => (
              <a
                key={t}
                className="rl-btn"
                href={researchApi.fileUrl(rec.id, t)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none", maxWidth: "100%" }}
                title="Open the original PDF"
              >
                <span className={`rl-tag ${t}`}>{t.toUpperCase()}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
                  {stripPdf(d.name)}
                </span>
                <span className="rl-sub">
                  {d.pages}p · {fmtBytes(d.size)}
                </span>
                <Icon name="external" size={13} />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="rl-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          {/* headline */}
          <div className="card">
            <div className="rl-pad">
              <div className="rl-row" style={{ marginBottom: 10 }}>
                <span className="rl-label">Summary</span>
                <span className={`rl-comp ${c.comparability.level}`} title={c.comparability.reason}>
                  {COMPARABILITY[c.comparability.level]}
                </span>
              </div>
              <p className="rl-headline">{c.headline}</p>
              {c.comparability.reason && (
                <p className="rl-sub" style={{ marginTop: 8 }}>
                  {c.comparability.reason}
                </p>
              )}
              <div style={{ marginTop: 16 }}>
                <Prose text={c.executive_summary} />
              </div>
              {truncated && (
                <div className="rl-banner warn" style={{ marginTop: 16 }}>
                  <Icon name="alert" />
                  <span>
                    One report was very long, so only its first part could be analyzed in full. Treat figures from
                    later pages with extra care.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* tabs */}
          <div className="card">
            <div className="rl-tabs" role="tablist">
              {tabs.map(([id, label, n]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  className={`rl-tab ${tab === id ? "on" : ""}`}
                  onClick={() => setTab(id)}
                >
                  {label}
                  {typeof n === "number" && n > 0 && <small>{n}</small>}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div className="rl-pad" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                <div className="rl-two">
                  <div className="rl-box a">
                    <span className="rl-tag a">Report A</span>
                    <div className="rl-label" style={{ marginTop: 12 }}>Strengths</div>
                    <Bullets items={c.strengths.a} />
                    <div className="rl-label" style={{ marginTop: 16 }}>Concerns</div>
                    <Bullets items={c.concerns.a} />
                  </div>
                  <div className="rl-box b">
                    <span className="rl-tag b">Report B</span>
                    <div className="rl-label" style={{ marginTop: 12 }}>Strengths</div>
                    <Bullets items={c.strengths.b} />
                    <div className="rl-label" style={{ marginTop: 16 }}>Concerns</div>
                    <Bullets items={c.concerns.b} />
                  </div>
                </div>
                {!!c.similarities.length && (
                  <div>
                    <div className="rl-label">What they have in common</div>
                    <Bullets items={c.similarities} />
                  </div>
                )}
                {c.outlook && (
                  <div>
                    <div className="rl-label">Outlook compared</div>
                    <p style={{ marginTop: 8, lineHeight: 1.7, color: "var(--ink-2)", fontSize: 15 }}>{c.outlook}</p>
                  </div>
                )}
                {!!c.next_steps.length && (
                  <div>
                    <div className="rl-label">What to look at next</div>
                    <Bullets items={c.next_steps} />
                  </div>
                )}
                {!!c.caveats.length && (
                  <div className="rl-banner warn">
                    <Icon name="alert" />
                    <div>
                      <b>Limitations</b>
                      <ul className="rl-list-ul" style={{ marginTop: 6 }}>
                        {c.caveats.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "differences" && (
              <div className="rl-pad">
                {c.key_differences.length ? (
                  c.key_differences.map((d, i) => (
                    <div className="rl-diff" key={i}>
                      <div className="rl-diff-h">{d.topic}</div>
                      <div className="rl-diff-cols">
                        <div className="rl-diff-col">
                          <span className="rl-tag a" style={{ marginBottom: 6 }}>Report A</span>
                          <div>{d.report_a}</div>
                        </div>
                        <div className="rl-diff-col">
                          <span className="rl-tag b" style={{ marginBottom: 6 }}>Report B</span>
                          <div>{d.report_b}</div>
                        </div>
                      </div>
                      {d.insight && (
                        <div className="rl-diff-ins">
                          <b>Why it matters:</b> {d.insight}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="rl-sub">No clear differences were identified.</p>
                )}
              </div>
            )}

            {tab === "metrics" && (
              <div className="rl-scroll">
                {c.metrics.length ? (
                  <table className="rl-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Report A</th>
                        <th>Report B</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.metrics.map((m, i) => (
                        <tr key={i}>
                          <td className="m">{m.metric}</td>
                          <td>{m.report_a}</td>
                          <td>{m.report_b}</td>
                          <td className="note">{m.note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="rl-empty">No comparable metrics were found in both reports.</div>
                )}
                <p className="rl-sub" style={{ padding: "12px 16px" }}>
                  Figures are shown as reported, with their own currency and period. Check the note column before
                  comparing two numbers directly.
                </p>
              </div>
            )}

            {tab === "reports" && (
              <div className="rl-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <ReportCard tone="a" name={da.name} a={an} />
                <ReportCard tone="b" name={db.name} a={bn} />
              </div>
            )}
          </div>
        </div>

        <AskPanel id={rec.id} initial={rec.chat} suggestions={c.suggested_questions} names={[da.name, db.name]} />
      </div>
    </div>
  );
}
