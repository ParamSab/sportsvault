'use client';
import { useStore } from '@/lib/store';
import AuthPage from '@/components/AuthPage';
import AppShell from '@/components/AppShell';

export default function Home() {
  const { state } = useStore();

  // While checking session/localStorage, show a full-screen loader
  // so users never see a flash of the login page when already logged in
  if (state.loading) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at top, #1a1f35 0%, #0a0e1a 60%)',
        gap: 16,
      }}>
        <div style={{ fontSize: '3rem', animation: 'float 1.5s ease-in-out infinite' }}>⚡</div>
        <div style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.5rem',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          SportsVault
        </div>
        <div style={{
          width: 32, height: 32,
          border: '3px solid rgba(99,102,241,0.2)',
          borderTop: '3px solid #6366f1',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        `}</style>
      </div>
    );
  }

  if (!state.isAuthenticated) return <AuthPage />;

  return <AppShell />;
}
