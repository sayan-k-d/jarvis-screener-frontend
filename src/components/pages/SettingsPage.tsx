'use client';
import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';

export default function SettingsPage({ onToast }: { onToast: (m: string) => void }) {
  const { mode, setMode } = useTheme();
  const [minComposite, setMinComposite] = useState(50);
  const [universe, setUniverse] = useState('Large Cap (70)');
  const [gate, setGate] = useState(false);
  const [notify, setNotify] = useState(true);

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 640 }}>
      {/* Appearance / theme */}
      <div className="card">
        <div className="card-head">
          <h3>Appearance</h3>
        </div>
        <div className="card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Theme</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>Choose light or dark. Saved to your account (server-side).</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`btn ${mode === 'light' ? 'solid' : ''}`} onClick={() => setMode('light')}>
                ☀ Light
              </button>
              <button className={`btn ${mode === 'dark' ? 'solid' : ''}`} onClick={() => setMode('dark')}>
                ☾ Dark
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Screener settings */}
      <div className="card">
        <div className="card-head">
          <h3>Screener Settings</h3>
        </div>
        <div className="card-pad">
          <div className="field-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Universe</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>Which set of stocks to score</div>
            </div>
            <select className="sel" value={universe} onChange={(e) => setUniverse(e.target.value)}>
              <option>Large Cap (70)</option>
              <option>Mega Cap (30)</option>
              <option>All Tracked</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Minimum Composite to Highlight</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>Rows below this are de-emphasized</div>
            </div>
            <select className="sel" value={minComposite} onChange={(e) => setMinComposite(+e.target.value)}>
              {[0, 30, 50, 70, 85].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Strict Entry Gate</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>Require next-FY revenue growth ≥ 10%</div>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={gate} onChange={(e) => setGate(e.target.checked)} style={{ accentColor: 'var(--blue)', width: 34, height: 18 }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{gate ? 'On' : 'Off'}</span>
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Weekly Email Summary</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>Send the ranked output after each run</div>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} style={{ accentColor: 'var(--blue)', width: 34, height: 18 }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{notify ? 'On' : 'Off'}</span>
            </label>
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn solid" onClick={() => onToast('Settings saved.')}>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
