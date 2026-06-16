'use client';
export default function OfflinePage() {
    return (
        <div style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#070b15',
            color: '#eef0f4',
            fontFamily: 'Inter, sans-serif',
            padding: 24,
            textAlign: 'center',
            gap: 16,
        }}>
            <div style={{ fontSize: '3.5rem' }}>⚡</div>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.5rem', margin: 0 }}>You're offline</h1>
            <p style={{ color: '#7d8899', fontSize: '0.9375rem', maxWidth: 280, lineHeight: 1.6, margin: 0 }}>
                Check your connection and try again. Your saved games and profile will sync when you're back online.
            </p>
            <button
                onClick={() => window.location.reload()}
                style={{
                    marginTop: 8,
                    padding: '12px 28px',
                    borderRadius: 9999,
                    background: 'linear-gradient(135deg, #8fc01f, #c6f432)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.9375rem',
                    border: 'none',
                    cursor: 'pointer',
                }}
            >
                Try again
            </button>
        </div>
    );
}
