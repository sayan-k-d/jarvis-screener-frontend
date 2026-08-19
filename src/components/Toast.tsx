'use client';
import { useEffect, useState, useCallback } from 'react';

let externalShow: ((m: string) => void) | null = null;
export function toast(m: string) {
  externalShow?.(m);
}

export default function Toast() {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);

  const display = useCallback((m: string) => {
    setMsg(m);
    setShow(true);
    setTimeout(() => setShow(false), 2200);
  }, []);

  useEffect(() => {
    externalShow = display;
    return () => {
      externalShow = null;
    };
  }, [display]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: `translateX(-50%) translateY(${show ? '0' : '140%'})`,
        background: 'var(--navy)',
        color: 'var(--ink)',
        border: '1px solid var(--line)',
        padding: '11px 18px',
        borderRadius: 8,
        fontSize: 12.5,
        boxShadow: '0 12px 32px rgba(0,0,0,.3)',
        transition: 'transform .28s',
        zIndex: 99,
      }}
    >
      {msg}
    </div>
  );
}
