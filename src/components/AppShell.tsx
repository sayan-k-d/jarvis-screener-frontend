"use client";
import { useEffect, useState } from "react";
import { NAV, PageId } from "@/lib/nav";
import { useTheme } from "@/context/ThemeContext";
import { useScreener } from "@/context/ScreenerContext";
import Sidebar from "@/components/Sidebar";
import Toast, { toast } from "@/components/Toast";
import DashboardPage from "@/components/pages/DashboardPage";
import ResultsPage from "@/components/pages/ResultsPage";
import MarketEtfsPage from "@/components/pages/MarketEtfsPage";
import BreakdownPage from "@/components/pages/BreakdownPage";
import AnalyticsPage from "@/components/pages/AnalyticsPage";
import StockAnalysis from "@/components/pages/StockAnalysis";
import ComparePage from "@/components/pages/ComparePage";
import ResearchLibraryPage from "@/components/pages/ResearchLibraryPage";
import SourcesPage from "@/components/pages/SourcesPage";
import SettingsPage from "@/components/pages/SettingsPage";
import AdminPage from "@/components/pages/AdminPage";
import DetailPage from "@/components/pages/DetailPage";
import AIPanel from "@/components/AIPanel";

const JARVIS_URL =
  process.env.NEXT_PUBLIC_JARVIS_URL || "https://jarvisintelligence.ai";

// The floating Jarvis AI chatbot is hidden for now. Set NEXT_PUBLIC_SHOW_CHATBOT=true in
// the frontend .env (and restart) to bring it back; none of its code was removed.
const SHOW_CHATBOT = process.env.NEXT_PUBLIC_SHOW_CHATBOT === "true";

export default function AppShell({ onSignOut }: { onSignOut: () => void }) {
  const [page, setPage] = useState<PageId>("dashboard");
  const [detailTicker, setDetailTicker] = useState<string>("");
  const [aiOpen, setAiOpen] = useState(false);
  const { mode, toggle } = useTheme();
  const { checkStatus, meta, liveOn } = useScreener();

  const toggleAI = () => setAiOpen((o) => !o);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const nav = (id: PageId) => {
    setPage(id);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openStock = (t: string) => {
    setDetailTicker(t);
    setPage("detail");
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const meta_ =
    page === "detail"
      ? [`${detailTicker} — Stock Detail`, "Full factor and risk breakdown"]
      : (() => {
          const m = NAV.find((n) => n[0] === page);
          return m ? [m[2], m[3] ?? ""] : ["", ""];
        })();

  return (
    <div className="shell">
      <Sidebar page={page} onNav={nav} onSignOut={onSignOut} />
      <div className="main">
        <header className="topbar">
          <div>
            <h1>{meta_[0]}</h1>
            {meta_[1] && <p>{meta_[1]}</p>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {liveOn && meta && (
              <div className="run-stamp">
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 99,
                    background: "var(--green)",
                    display: "inline-block",
                  }}
                />
                Last run {new Date(meta.ranAt).toLocaleDateString()}
              </div>
            )}
            <a
              className="btn solid"
              href={JARVIS_URL}
              title="Back to Jarvis"
              style={{
                padding: "7px 11px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ← Back to Jarvis
            </a>
            <button
              className="btn"
              onClick={toggle}
              title={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
              style={{ padding: "7px 11px" }}
            >
              {mode === "dark" ? "☀ Light" : "☾ Dark"}
            </button>
          </div>
        </header>
        <div className="content">
          {page === "dashboard" && (
            <DashboardPage onNav={nav} onOpenStock={openStock} />
          )}
          {page === "results" && <ResultsPage onOpenStock={openStock} />}
          {page === "marketEtfs" && <MarketEtfsPage />}
          {page === "breakdown" && <BreakdownPage onOpenStock={openStock} />}
          {page === "stock_analysis" && <StockAnalysis />}
          {page === "compare" && <ComparePage onOpenStock={openStock} />}
          {page === "researchLibrary" && <ResearchLibraryPage />}
          {page === "sources" && <SourcesPage />}
          {page === "settings" && <SettingsPage onToast={toast} />}
          {page === "admin" && <AdminPage onToast={toast} />}
          {page === "detail" && detailTicker && (
            <DetailPage ticker={detailTicker} />
          )}
        </div>
      </div>
      <Toast />

      {SHOW_CHATBOT && (
        <>
          <button
            className={`ai-toggle${aiOpen ? " hidden" : ""}`}
            onClick={toggleAI}
            type="button"
            aria-label="Open Jarvis AI assistant"
          >
            <i className="fas fa-robot" />
          </button>
          <AIPanel isOpen={aiOpen} onToggle={toggleAI} />
        </>
      )}
    </div>
  );
}
