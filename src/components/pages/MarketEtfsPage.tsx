"use client";

// Placeholder while the Market & ETFs page is being built.
const COMING: [string, string][] = [
  ["Sector & theme leadership", "See which parts of the market are leading and which are lagging."],
  ["ETF performance", "Returns across 1 week, 30 and 90 trading days and year to date, measured against a benchmark."],
  ["Rotation & reversals", "Spot leadership that is strengthening, fading or turning around."],
];

export default function MarketEtfsPage() {
  return (
    <div className="card">
      <div
        style={{
          padding: "56px 24px 44px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            display: "grid",
            placeItems: "center",
            background: "var(--card-2)",
            border: "1px solid var(--line)",
            color: "var(--blue)",
          }}
          aria-hidden="true"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M7 15l4-5 3 3 5-6" />
          </svg>
        </div>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            padding: "3px 11px",
            borderRadius: 999,
            background: "var(--amber-bg)",
            color: "var(--amber)",
          }}
        >
          In development
        </span>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>
          Market &amp; ETFs is coming soon
        </h2>
        <p style={{ margin: 0, maxWidth: 520, color: "var(--muted)", fontSize: 14.5, lineHeight: 1.65 }}>
          We&apos;re building this page to show where leadership is moving across the market, using ETFs to
          make sector and theme rotation easy to follow.
        </p>

        <div
          style={{
            marginTop: 18,
            width: "100%",
            maxWidth: 760,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 12,
            textAlign: "left",
          }}
        >
          {COMING.map(([t, d]) => (
            <div
              key={t}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "14px 16px",
                background: "var(--card-2)",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t}</div>
              <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.55, marginTop: 5 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
