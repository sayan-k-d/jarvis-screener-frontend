'use client';
import { useScreener } from '@/context/ScreenerContext';

export default function AdminPage({ onToast }: { onToast: (m: string) => void }) {
  const { meta, loading, progress, runLive, liveOn, hasKey } = useScreener();

  const pctDone = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : liveOn ? 100 : 0;
  const lastRun = meta ? new Date(meta.ranAt).toLocaleString() : '—';

  return (
    <div className="card">
      <div className="card-head">
        <h3>Weekly Screener Run</h3>
        <span className={`badge ${loading ? 'b-watch' : liveOn ? 'b-done' : 'b-watch'}`}>
          {loading ? 'Running' : liveOn ? 'Completed' : 'Idle'}
        </span>
      </div>
      <div className="card-pad">
        <div className="grid g4" style={{ paddingBottom: 18, borderBottom: '1px solid var(--line)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>Last Run</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{lastRun}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>Status</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6, color: loading ? 'var(--amber)' : 'var(--green)' }}>
              {loading ? 'In progress…' : liveOn ? 'Completed successfully' : 'Not yet run'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>Fetched</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{meta ? `${meta.fetched}/${meta.universeN}` : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>Failures</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{meta ? meta.failures : '—'}</div>
          </div>
        </div>

        <div style={{ padding: '18px 0', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, marginBottom: 9 }}>
            Progress{progress ? ` — ${progress.label}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 8, background: 'var(--line-soft)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pctDone}%`, background: 'var(--blue)', borderRadius: 99, transition: 'width .3s' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{pctDone}%</span>
          </div>
        </div>

        <div style={{ padding: '18px 0', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, marginBottom: 10 }}>Actions</div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button className="btn solid" onClick={runLive} disabled={loading || hasKey === false}>
              {loading ? 'Running…' : 'Run Now'}
            </button>
            <button className="btn" onClick={() => onToast('Recalculating composite scores…')}>Recalculate</button>
            <button className="btn" onClick={() => onToast('Opening run logs…')}>View Logs</button>
            <button className="btn" onClick={() => onToast('Report downloaded.')}>Download Report</button>
          </div>
          {hasKey === false && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red)' }}>
              No Alpha Vantage API key configured on the server. Set AV_API_KEY in the backend .env to enable runs.
            </div>
          )}
        </div>

        <div style={{ paddingTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Run Schedule</div>
            <div style={{ fontSize: 12.5, marginTop: 5 }}>Every Monday 8:00 AM</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>Next run: next Monday</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 7 }}>Auto Run</div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: 'var(--blue)', width: 34, height: 18 }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>On</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
