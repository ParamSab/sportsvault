'use client';
import { useState, useRef } from 'react';

// Venue search: Photon (komoot) first — fast, typo-tolerant autocomplete —
// with Nominatim as fallback. Both are keyless OSM geocoders. Results are
// biased toward the current pin (user's area), not a hardcoded city.
async function photonSearch(q, lat, lng) {
    const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&lat=${lat}&lon=${lng}`
    );
    const data = await res.json();
    return (data.features || []).map(f => {
        const p = f.properties || {};
        const parts = [p.name, p.street, p.district, p.city, p.state].filter(Boolean);
        return {
            lat: f.geometry?.coordinates?.[1],
            lon: f.geometry?.coordinates?.[0],
            name: p.name || parts[0] || q,
            display_name: [...new Set(parts)].join(', '),
        };
    }).filter(r => r.lat != null && r.lon != null);
}

async function nominatimSearch(q, lat, lng) {
    // ~25km bias box around the current pin
    const d = 0.25;
    const viewbox = `${lng - d},${lat + d},${lng + d},${lat - d}`;
    const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}` +
        `&countrycodes=in&limit=6&viewbox=${viewbox}&bounded=0`,
        { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    return (data || []).map(r => ({
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        name: r.name || r.display_name.split(',')[0],
        display_name: r.display_name,
    }));
}

export default function MapPicker({ lat = 19.076, lng = 72.877, onLocationChange }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [noResults, setNoResults] = useState(false);
    const [pinned, setPinned] = useState({ lat, lng, name: '', address: '' });
    const searchTimeout = useRef(null);
    const searchSeq = useRef(0);

    const mapSrc = `https://maps.google.com/maps?q=${pinned.lat},${pinned.lng}&z=16&output=embed`;

    const searchPlaces = async (q) => {
        if (!q || q.trim().length < 2) { setResults([]); setNoResults(false); return; }
        const seq = ++searchSeq.current;
        setSearching(true);
        setNoResults(false);
        let found = [];
        try {
            found = await photonSearch(q, pinned.lat, pinned.lng);
        } catch { /* photon down — try nominatim */ }
        if (found.length === 0) {
            try {
                found = await nominatimSearch(q, pinned.lat, pinned.lng);
            } catch { /* both geocoders failed */ }
        }
        if (seq !== searchSeq.current) return; // stale response — a newer search is in flight
        setResults(found);
        setNoResults(found.length === 0);
        setSearching(false);
    };

    const handleInputChange = (e) => {
        const v = e.target.value;
        setQuery(v);
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => searchPlaces(v), 300);
    };

    const applySelection = ({ lat: lt, lng: ln, name, address }) => {
        setPinned({ lat: lt, lng: ln, name, address });
        setQuery(name);
        setResults([]);
        setNoResults(false);
        onLocationChange?.({ lat: lt, lng: ln, name, address });
    };

    const handleSelectResult = (place) => {
        applySelection({
            lat: place.lat, lng: place.lon,
            name: place.name,
            address: place.display_name,
        });
    };

    // Venue not in the map database — keep the user's typed name and pin at the
    // current map position so they're never blocked from creating the game.
    const handleUseTypedName = () => {
        applySelection({
            lat: pinned.lat, lng: pinned.lng,
            name: query.trim(),
            address: pinned.address || `${pinned.lat.toFixed(4)}, ${pinned.lng.toFixed(4)}`,
        });
    };

    const handleGPS = () => {
        if (!navigator.geolocation) return alert('Geolocation not supported');
        setSearching(true);
        navigator.geolocation.getCurrentPosition(async pos => {
            const lt = pos.coords.latitude, ln = pos.coords.longitude;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lt}&lon=${ln}`);
                const data = await res.json();
                const name = data.name || data.address?.road || data.display_name.split(',')[0] || 'Current Location';
                const address = data.display_name;
                applySelection({ lat: lt, lng: ln, name, address });
            } catch {
                setPinned(p => ({ ...p, lat: lt, lng: ln }));
                onLocationChange?.({ lat: lt, lng: ln, name: 'Dropped Pin', address: `${lt.toFixed(4)}, ${ln.toFixed(4)}` });
            }
            setSearching(false);
        }, (err) => {
            setSearching(false);
            console.error('GPS Error:', err);
            alert(`Could not get location: ${err.message}. Please search manually.`);
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    };

    const showDropdown = searching || results.length > 0 || (noResults && query.trim().length >= 2);

    return (
        <div style={{ position: 'relative' }}>
            {/* Search bar */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
                <input
                    type="text"
                    placeholder="🔍 Search venue, club, turf, area..."
                    value={query}
                    onChange={handleInputChange}
                    style={{ width: '100%', paddingRight: 90 }}
                />
                <button
                    type="button"
                    onClick={handleGPS}
                    style={{
                        position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                        background: 'rgba(198,244,50,0.2)', border: '1px solid rgba(198,244,50,0.4)',
                        borderRadius: 6, padding: '5px 10px', fontSize: '0.75rem', fontWeight: 600,
                        color: '#d8fa5a', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>
                    📍 GPS
                </button>

                {/* Dropdown: results / searching / no-results fallback */}
                {showDropdown && (
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                        borderRadius: 10, marginTop: 4, overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}>
                        {searching && (
                            <div style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                Searching…
                            </div>
                        )}
                        {!searching && results.map((r, i) => (
                            <button key={i} type="button"
                                onClick={() => handleSelectResult(r)}
                                style={{
                                    display: 'block', width: '100%', padding: '12px 16px',
                                    textAlign: 'left', background: 'transparent',
                                    border: 'none', borderBottom: '1px solid var(--border-color)',
                                    cursor: 'pointer', transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 2 }}>
                                    📍 {r.name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.display_name}
                                </div>
                            </button>
                        ))}
                        {!searching && noResults && (
                            <div style={{ padding: '12px 16px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                No places found for “{query.trim()}”.
                            </div>
                        )}
                        {/* Always offer the escape hatch once the user has typed something */}
                        {!searching && query.trim().length >= 2 && (
                            <button type="button" onClick={handleUseTypedName}
                                style={{
                                    display: 'block', width: '100%', padding: '12px 16px',
                                    textAlign: 'left', background: 'rgba(198,244,50,0.08)',
                                    border: 'none', cursor: 'pointer',
                                    fontSize: '0.8125rem', fontWeight: 600, color: '#d8fa5a',
                                }}>
                                ✏️ Use “{query.trim()}” as the venue name (pin stays where the map is)
                            </button>
                        )}
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
