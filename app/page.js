'use client';
import { useStore } from '@/lib/store';
import AuthPage from '@/components/AuthPage';
import AppShell from '@/components/AppShell';

export default function Home() {
  const { state } = useStore();

  if (!state.isAuthenticated) {
    return <AuthPage />;
  }

  return <AppShell />;
}
