'use client';
import { useState } from 'react';
import Login from '@/components/Login';
import AppShell from '@/components/AppShell';
import { ScreenerProvider } from '@/context/ScreenerContext';

export default function Home() {
  const [signedIn, setSignedIn] = useState(true); //make it false for the login screen

  if (!signedIn) return <Login onSignIn={() => setSignedIn(true)} />;

  return (
    <ScreenerProvider>
      <AppShell onSignOut={() => setSignedIn(false)} />
    </ScreenerProvider>
  );
}
