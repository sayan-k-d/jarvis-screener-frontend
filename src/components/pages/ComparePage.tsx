"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { adaptRow } from "@/lib/format";
import { InfoTip, FORMULAS } from "@/components/InfoTip";

export default function ComparePage({
  onOpenStock,
}: {
  onOpenStock: (t: string) => void;
}) {
  const [cmp, setCmp] = useState<string[]>(["NVDA", "META", "AMD"]);
  const [rowsByT, setRowsByT] = useState<Record<string, any>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tried, setTried] = useState(false);

  const score = useCallback(async (tickers: string[]) => {
    if (!tickers.length) {
      setRowsByT({});
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.compare(tickers);
      const map: Record<string, any> = {};
      (res.rows || []).forEach((r) => {
        map[r.t] = adaptRow(r);
      });
      setRowsByT(map);
      if (res.failures?.length && !res.rows?.length) {
        setError(
          `No data returned for: ${res.failures.join(", ")}. Check the symbols or the API limit.`,
        );
      }
    } catch (e) {
      setError((e as Error).message || "Could not load comparison data.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!tried) {
      setTried(true);
      score(cmp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = () => {
    const t = input.trim().toUpperCase();
    if (!t) return;
    if (cmp.includes(t)) return;
    if (cmp.length >= 4) {
      setError("Compare up to 4 tickers at a time.");
      return;
    }
    if (!/^[A-Z.\-]{1,8}$/.test(t)) {
      setError("Enter a valid ticker symbol.");
      return;
    }
    const next = [...cmp, t];
    setCmp(next);
    setInput("");
    score(next);
  };
  const remove = (t: string) => {
    const next = cmp.filter((x) => x !== t);
    setCmp(next);
    score(next);
  };
  const clear = () => {
    setCmp([]);
    setRowsByT({});
  };

  const list = cmp.map((t) => rowsByT[t]).filter(Boolean);
  const best = list.length
    ? list.reduce((a, b) => (a.sc >= b.sc ? a : b))
    : null;

  const metricRows: [string, (s: any) => any, string][] = [
    ["Composite Score", (s) => s.sc, FORMULAS.composite],
    ["Price Momentum", (s) => s.g[0], FORMULAS.A],
    ["Forward Earnings Momentum", (s) => s.g[1], FORMULAS.B],
    ["Business Quality & ROIC", (s) => s.g[2], FORMULAS.C],
    ["Valuation Discipline", (s) => s.g[3], FORMULAS.D],
    ["Revenue Momentum", (s) => s.g[4], FORMULAS.E],
    ["ROIC", (s) => s.roicStr, FORMULAS.roic],
    ["EV / EBITDA", (s) => s.evStr, FORMULAS.ev],
    ["P / FCF", (s) => s.pfcfStr, FORMULAS.pfcf],
    ["Trailing P / E", (s) => s.peStr, FORMULAS.pe],
  ];

  return (
    <div className="card">
      <div className="toolbar" style={{ alignItems: "center" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
          Add tickers to compare
        </span>
        <div
          id="cmpChips"
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          {cmp.map((t) => (
            <span
              key={t}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--card-2)",
                color: "var(--blue-dk)",
                padding: "5px 9px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 700,
                border: "1px solid var(--line)",
              }}
            >
              {t}
              <span
                style={{ cursor: "pointer", color: "var(--muted)" }}
                onClick={() => remove(t)}
              >
                ✕
              </span>
            </span>
          ))}
        </div>
        <input
          className="inp"
          style={{ maxWidth: 160, flex: "0 0 auto" }}
          placeholder="Add ticker…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="btn solid" onClick={add}>
          Compare
        </button>
        <button className="btn" onClick={clear}>
          Clear
        </button>
      </div>

      {error && (
        <div
          style={{ padding: "10px 18px", color: "var(--red)", fontSize: 12.5 }}
        >
          {error}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table id="cmpTable">
          {loading ? (
            <tbody>
              <tr>
                <td
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "var(--muted)",
                  }}
                >
                  <span
                    className="spin"
                    style={{ marginRight: 8, verticalAlign: "middle" }}
                  />
                  Fetching &amp; scoring live data from Alpha Vantage…
                </td>
              </tr>
            </tbody>
          ) : !cmp.length ? (
            <tbody>
              <tr>
                <td
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "var(--muted)",
                  }}
                >
                  Add a ticker above to start a comparison.
                </td>
              </tr>
            </tbody>
          ) : !list.length ? (
            <tbody>
              <tr>
                <td
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "var(--muted)",
                  }}
                >
                  No data returned for the selected tickers.
                </td>
              </tr>
            </tbody>
          ) : (
            <>
              <thead>
                <tr>
                  <th>Metric</th>
                  {list.map((s) => (
                    <th key={s.t} style={{ textAlign: "center" }}>
                      <div
                        className="tkr"
                        style={{ fontSize: 13 }}
                        onClick={() => onOpenStock(s.t)}
                      >
                        {s.t}
                      </div>
                      <div
                        style={{
                          fontWeight: 400,
                          textTransform: "none",
                          letterSpacing: 0,
                          marginTop: 3,
                        }}
                      >
                        {(s.n || "").split(",")[0]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metricRows.map(([label, fn, tip]) => (
                  <tr key={label}>
                    <td style={{ fontWeight: 500 }}>
                      {label}
                      <InfoTip label={label} text={tip} />
                    </td>
                    {list.map((s) => {
                      const v = fn(s);
                      const val =
                        v === undefined ||
                        v === null ||
                        (typeof v === "number" && !isFinite(v))
                          ? "—"
                          : v;
                      return (
                        <td
                          key={s.t}
                          className="num"
                          style={{
                            textAlign: "center",
                            background:
                              best && s.t === best.t
                                ? "var(--green-bg)"
                                : "transparent",
                            color: "var(--ink)",
                          }}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
  );
}
