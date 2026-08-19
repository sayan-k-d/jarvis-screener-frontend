'use client';
import { useState } from 'react';

export default function Login({ onSignIn }: { onSignIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => {
    // No backend auth in this build — any credentials proceed (internal tool).
    onSignIn();
  };

  return (
    <div id="login">
      <div className="login-card">
        <div className="brand">
          <div className="brand-mark">J</div>
          <div className="brand-txt">
            <div className="brand-name">JARVIS</div>
            <div className="brand-sub">INTELLIGENCE GROUP</div>
          </div>
        </div>
        <div className="login-title">Weekly Momentum Screener</div>
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            placeholder="you@firm.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        <div className="login-row">
          <label className="chk">
            <input type="checkbox" defaultChecked /> Remember me
          </label>
          <span className="link">Forgot password?</span>
        </div>
        <button className="btn-primary" onClick={submit}>
          Sign In
        </button>
        <div className="login-foot">FOR INTERNAL DEVELOPMENT USE ONLY</div>
      </div>
    </div>
  );
}
