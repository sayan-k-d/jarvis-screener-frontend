"use client";
import { useEffect, useState } from "react";
import type { ResearchRecord } from "@/lib/researchApi";
import { Icon, stripPdf } from "./ui";

const TIPS = [
  "Reading every page and keeping track of page numbers",
  "Pulling out the key figures, risks and outlook",
  "Checking that periods and currencies line up",
  "Looking for where the two reports truly differ",
  "Once ready, you can ask questions about both reports",
];

type StepState = "pending" | "active" | "done" | "err";

function Doc({
  x,
  tone,
  busy,
  done,
  failed,
}: {
  x: number;
  tone: "a" | "b";
  busy: boolean;
  done: boolean;
  failed: boolean;
}) {
  const y = 20;
  return (
    <g className={`rl-doc ${tone} ${busy ? "busy" : ""}`}>
      <rect className="rl-doc-body" x={x} y={y} width={100} height={136} rx={9} />
      <rect className="rl-doc-top" x={x} y={y} width={100} height={14} rx={7} />
      <rect className="rl-doc-top" x={x} y={y + 8} width={100} height={6} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <line
          key={i}
          className="rl-doc-line"
          x1={x + 14}
          x2={x + (i % 3 === 2 ? 58 : 86)}
          y1={y + 34 + i * 14}
          y2={y + 34 + i * 14}
        />
      ))}
      {busy && <rect className="rl-scan" x={x + 6} y={y + 26} width={88} height={4} rx={2} opacity={0.55} />}
      {(done || failed) && (
        <g transform={`translate(${x + 72} ${y + 104})`}>
          <circle r={14} cx={14} cy={14} fill={failed ? "var(--red)" : "var(--blue)"} />
          <path
            d={failed ? "M9 9l10 10M19 9L9 19" : "M8 14.5l4 4 8-9"}
            fill="none"
            stroke="#fff"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
    </g>
  );
}

export default function AnalysisLoader({ rec }: { rec: ResearchRecord }) {
  const [now, setNow] = useState(Date.now());
  const [shown, setShown] = useState(Math.max(2, rec.progress));
  const [tip, setTip] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    const tips = setInterval(() => setTip((v) => (v + 1) % TIPS.length), 4200);
    return () => {
      clearInterval(t);
      clearInterval(tips);
    };
  }, []);

  // Ease the displayed bar toward the server's progress and creep slowly between
  // updates, so it keeps moving during long analysis calls without ever jumping back.
  useEffect(() => {
    const target = rec.progress;
    const cap = Math.min(96, target + (rec.stage === "analyze" ? 22 : rec.stage === "compare" ? 14 : 5));
    const t = setInterval(() => {
      setShown((s) => {
        if (s < target) return Math.min(target, s + Math.max(0.6, (target - s) * 0.18));
        if (s < cap) return s + 0.06;
        return s;
      });
    }, 250);
    return () => clearInterval(t);
  }, [rec.progress, rec.stage]);

  const [a, b] = rec.docs;
  const readDone = [a, b].every((d) => ["extracted", "analyzing", "analyzed"].includes(d.status));
  const readErr = [a, b].some((d) => d.status === "error" && d.pages === 0);
  const docState = (d: typeof a): StepState =>
    d.status === "analyzed" ? "done" : d.status === "analyzing" ? "active" : d.status === "error" ? "err" : "pending";

  const steps: { label: string; detail?: string; state: StepState }[] = [
    { label: "Upload received", state: "done" },
    {
      label: "Reading both reports",
      detail: readDone ? `${a.pages + b.pages} pages` : undefined,
      state: readErr ? "err" : readDone ? "done" : "active",
    },
    { label: "Analyzing Report A", detail: stripPdf(a.name), state: docState(a) },
    { label: "Analyzing Report B", detail: stripPdf(b.name), state: docState(b) },
    {
      label: "Comparing the two reports",
      state: rec.stage === "compare" ? "active" : rec.stage === "done" ? "done" : "pending",
    },
  ];

  const secs = Math.max(0, Math.floor((now - new Date(rec.createdAt).getTime()) / 1000));
  const mm = Math.floor(secs / 60);
  const elapsed = `${mm}:${String(secs % 60).padStart(2, "0")}`;
  const pct = Math.min(100, Math.round(shown));

  return (
    <div className="rl-load" role="status" aria-live="polite">
      <div className="rl-scene">
        <svg viewBox="0 0 560 176" aria-hidden="true">
          <path className="rl-beam a" d="M130 88 C 180 88, 200 88, 246 88" />
          <path className="rl-beam b" d="M430 88 C 380 88, 360 88, 314 88" />
          <Doc x={30} tone="a" busy={["extracting", "analyzing"].includes(a.status)} done={a.status === "analyzed"} failed={a.status === "error"} />
          <Doc x={430} tone="b" busy={["extracting", "analyzing"].includes(b.status)} done={b.status === "analyzed"} failed={b.status === "error"} />
          <circle className="rl-node" cx={280} cy={88} r={32} />
          <circle className="rl-node-ring" cx={280} cy={88} r={32} style={{ transformOrigin: "280px 88px" }} />
          <path
            d="M268 80h24M268 88h16M268 96h20"
            stroke="var(--blue)"
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      <h3 className="rl-load-title">Analyzing your reports</h3>
      <p className="rl-load-msg" key={tip}>
        {TIPS[tip]}…
      </p>

      <div className="rl-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="rl-sub" style={{ marginTop: 8, width: "100%", maxWidth: 560, display: "flex", justifyContent: "space-between" }}>
        <span>{rec.message || "Working"}</span>
        <span>
          {pct}% · {elapsed}
        </span>
      </div>

      <div className="rl-steps">
        {steps.map((s) => (
          <div key={s.label} className={`rl-step ${s.state}`}>
            <span className="rl-step-ic">
              {s.state === "done" ? (
                <Icon name="check" size={13} />
              ) : s.state === "err" ? (
                <Icon name="x" size={13} />
              ) : s.state === "active" ? (
                <span className="rl-spinner" />
              ) : null}
            </span>
            <span className="rl-step-t">{s.label}</span>
            {s.detail && <span className="rl-step-s">{s.detail}</span>}
          </div>
        ))}
      </div>
      <p className="rl-foot">
        This usually takes under a minute. You can leave this page — the analysis keeps running and
        will appear in your library.
      </p>
    </div>
  );
}
