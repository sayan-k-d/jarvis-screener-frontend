'use client';
import React from 'react';
import { tierClass, fmtScore } from '@/lib/format';

export function TierBadge({ tier }: { tier: string }) {
  return <span className={`badge ${tierClass(tier)}`}>{tier}</span>;
}

// Weekly-delta cell: "NEW" on first appearance, — within ±2, else ▲/▼.
export function DeltaCell({ d, isNew }: { d: number; isNew?: boolean }) {
  if (isNew)
    return (
      <span
        style={{
          color: '#f2c94c',
          background: 'var(--amber-bg)',
          border: '1px solid #4a3d15',
          padding: '1px 7px',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        NEW
      </span>
    );
  const dd = Number.isFinite(d) ? d : 0; // exact change, shown to 2 decimals
  if (Math.abs(dd) <= 2)
    return <span style={{ color: 'var(--muted)' }}>{`— ${dd >= 0 ? '+' : ''}${fmtScore(dd)}`}</span>;
  const up = dd > 0,
    strong = Math.abs(dd) > 5;
  const color = up ? (strong ? '#0d9488' : 'var(--green)') : strong ? '#dc2626' : 'var(--red)';
  return (
    <span style={{ color, fontWeight: 600 }}>
      {up ? '▲' : '▼'} {fmtScore(Math.abs(dd))}
    </span>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}
