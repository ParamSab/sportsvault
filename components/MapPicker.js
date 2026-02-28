'use client';
import { useState, useRef, useEffect } from 'react';

export default function MapPicker({ lat = 19.076, lng = 72.877, onLocationChange }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [pinned, setPinned] = useState({ lat, lng, name: '', address: '' });
    const searchTimeout = useRef(null);

    // Update iframe src whenever pin changes
    const mapSrc = `https://maps.google.com/maps?q=${pinned.lat},${pinned.lng}&z=16&output=embed`;

    const searchPlaces = async (q) => {
        if (!q || q.trim().length < 3) { setResults([]); return; }
        setSearching(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                `format=json&q=${encodeURIComponent(q)}&countrycodes=in&limit=6&addressdetails=1`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const data = await res.json();
            setResults(data);
        } catch { setResults([]); }
        setSearching(false);
    };

    const handleInputChange = (e) => {
        const v = e.target.value;
        setQuery(v);
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => searchPlaces(v), 400);
    };

    const handleSelectResult = (place) => {
        const lt = parseFloat(place.lat);
        const ln = parseFloat(place.lon);
        const name = place.name || place.display_name.split(',')[0];
        const address = place.display_name;
        setPinned({ lat: lt, lng: ln, name, address });
        setQuery(name);
        setResults([]);
        onLocationChange?.({ lat: lt, lng: ln, name, address });
    };

    const handleGPS = () => {
        if (!navigator.geolocation) return alert('Geolocation not supported');
        navigator.geolocation.getCurrentPosition(async pos => {
            const lt = pos.coords.latitude, ln = pos.coords.longitude;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lt}&lon=${ln}`);
                const data = await res.json();
                const name = data.name || data.address?.road || data.display_name.split(',')[0];
                const address = data.display_name;
                setPinned({ lat: lt, lng: ln, name, address });
                setQuery(name);
                onLocationChange?.({ lat: lt, lng: ln, name, address });
            } catch {
                setPinned(p => ({ ...p, lat: lt, lng: ln }));
                onLocationChange?.({ lat: lt, lng: ln, name: '', address: '' });
            }
        }, () => alert('Could not get location'), { enableHighAccuracy: true });
    };

    return (
        <div style={{ position: 'relative' }}>
            {/* Search bar */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
                <input
                    type="text"
                    placeholder="🔍 Search for a venue, park, stadium..."
                    value={query}
                    onChange={handleInputChange}
                    style={{ width: '100%', paddingRight: 90 }}
                />
                <button
                    type="button"
                    onClick={handleGPS}
                    style={{
                        position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                        background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
                        borderRadius: 6, padding: '5px 10px', fontSize: '0.75rem', fontWeight: 600,
                        color: '#818cf8', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>
                    📍 GPS
                </button>

                {/* Dropdown results */}
                {results.length > 0 && (
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                        borderRadius: 10, marginTop: 4, overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}>
                        {results.map((r, i) => (
                            <button key={i} type="button"
                                onClick={() => handleSelectResult(r)}
                                style={{
                                    display: 'block', width: '100%', padding: '12px 16px',
                                    textAlign: 'left', background: 'transparent',
                                    border: 'none', borderBottom: i < results.length - 1 ? '1px solid var(--border-color)' : 'none',
                                    cursor: 'pointer', transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 2 }}>
                                    📍 {r.name || r.display_name.split(',')[0]}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.display_name}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {searching && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, padding: '10px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        Searching...
                    </div>
                )}
            </div>

            {/* Google Maps iframe */}
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-color)', height: 240, position: 'relative' }}>
                <iframe
                    key={`${pinned.lat},${pinned.lng}`}
                    src={mapSrc}
                    width="100%" height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Game location"
                />
            </div>

            {/* Current selection display */}
            {pinned.name && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    📍 <strong style={{ color: 'var(--text-primary)' }}>{pinned.name}</strong>
                </div>
            )}
        </div>
    );
}
