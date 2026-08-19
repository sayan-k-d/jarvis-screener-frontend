'use client';
import { useEffect, useState } from 'react';
import { NAV, PageId } from '@/lib/nav';
import { useTheme } from '@/context/ThemeContext';
import { useScreener } from '@/context/ScreenerContext';
import Sidebar from '@/components/Sidebar';
import Toast, { toast } from '@/components/Toast';
import DashboardPage from '@/components/pages/DashboardPage';
import ResultsPage from '@/components/pages/ResultsPage';
import HistoryPage from '@/components/pages/HistoryPage';
import BreakdownPage from '@/components/pages/BreakdownPage';
import AnalyticsPage from '@/components/pages/AnalyticsPage';
import ComparePage from '@/components/pages/ComparePage';
import SourcesPage from '@/components/pages/SourcesPage';
import SettingsPage from '@/components/pages/SettingsPage';
import AdminPage from '@/components/pages/AdminPage';
import DetailPage from '@/components/pages/DetailPage';

export default function AppShell({ onSignOut }: { onSignOut: () => void }) {
  const [page, setPage] = useState<PageId>('dashboard');
  const [detailTicker, setDetailTicker] = useState<string>('');
  const { mode, toggle } = useTheme();
  const { checkStatus, meta, liveOn } = useScreener();

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const nav = (id: PageId) => {
    setPage(id);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openStock = (t: string) => {
    setDetailTicker(t);
    setPage('detail');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const meta_ = page === 'detail' ? [`${detailTicker} — Stock Detail`, 'Full factor and risk breakdown'] : (() => {
    const m = NAV.find((n) => n[0] === page);
    return m ? [m[2], m[3]] : ['', ''];
  })();

  return (
    <div className="shell">
      <Sidebar page={page} onNav={nav} onSignOut={onSignOut} />
      <div className="main">
        <header className="topbar">
          <div>
            <h1>{meta_[0]}</h1>
            <p>{meta_[1]}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {liveOn && meta && (
              <div className="run-stamp">
                <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--green)', display: 'inline-block' }} />
                Last run {new Date(meta.ranAt).toLocaleDateString()}
              </div>
            )}
            <button
              className="btn"
              onClick={toggle}
              title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
              style={{ padding: '7px 11px' }}
            >
              {mode === 'dark' ? '☀ Light' : '☾ Dark'}
            </button>
          </div>
        </header>
        <div className="content">
          {page === 'dashboard' && <DashboardPage />}
          {page === 'results' && <ResultsPage onOpenStock={openStock} />}
          {page === 'history' && <HistoryPage />}
          {page === 'breakdown' && <BreakdownPage onOpenStock={openStock} />}
          {page === 'analytics' && <AnalyticsPage />}
          {page === 'compare' && <ComparePage onOpenStock={openStock} />}
          {page === 'sources' && <SourcesPage />}
          {page === 'settings' && <SettingsPage onToast={toast} />}
          {page === 'admin' && <AdminPage onToast={toast} />}
          {page === 'detail' && detailTicker && <DetailPage ticker={detailTicker} />}
        </div>
      </div>
      <Toast />
    </div>
  );
}
