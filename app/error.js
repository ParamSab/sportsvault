'use client';

export default function Error({ error, reset }) {
    return (
        <div style={{
            minHeight: '100dvh', background: 'var(--bg-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
        }}>
            <div style={{ textAlign: 'center', maxWidth: 360 }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
                <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 24, textAlign: 'left', wordBreak: 'break-all' }}>
                    <strong>Message:</strong> {error?.message || 'An unexpected error occurred.'}
                    <br/><br/>
                    <strong>Stack:</strong> {error?.stack || 'No stack trace provided by React Fiber.'}
                </p>
                <button
                    className="btn btn-primary btn-block"
                    onClick={reset}
                >
                    Try Again
                </button>
            </div>
        </div>
    );
}
