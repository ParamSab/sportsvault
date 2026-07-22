'use client';
// Lightweight first-party analytics. track() is fire-and-forget: it never
// throws, never blocks, and silently no-ops if offline. Events are stored in
// our own DB (see /api/track) tied to the session user when available.

export function track(name, props) {
    try {
        if (typeof window === 'undefined' || !name) return;
        const body = JSON.stringify(props ? { name, props } : { name });
        // Prefer sendBeacon so the request survives navigation/backgrounding.
        if (navigator.sendBeacon) {
            const blob = new Blob([body], { type: 'application/json' });
            navigator.sendBeacon('/api/track', blob);
            return;
        }
        fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
        }).catch(() => {});
    } catch { /* analytics must never break the app */ }
}
