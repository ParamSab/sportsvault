// ============================================
// AUTO TEAM BALANCER + WHATSAPP GENERATOR
// ============================================

export function balanceTeams(players, sport) {
    if (!players || players.length < 2) return { team1: players || [], team2: [] };
    const enriched = players.map(p => {
        if (!p) return null;
        const rating = (p.ratings || {})[sport];
        const hasRating = rating && rating.count >= 10;
        return { ...p, effectiveRating: hasRating ? rating.overall : 3.5, isRated: hasRating, position: p.rsvpPosition || (p.positions || {})[sport] || 'Unknown' };
    }).filter(Boolean);
    enriched.sort((a, b) => b.effectiveRating - a.effectiveRating);
    const team1 = [], team2 = [];
    enriched.forEach((player, index) => {
        const round = Math.floor(index / 2);
        if (index % 2 === 0) { if (round % 2 === 0) team1.push(player); else team2.push(player); }
        else { if (round % 2 === 0) team2.push(player); else team1.push(player); }
    });
    const avg = (team) => team.length === 0 ? 0 : Math.round((team.reduce((s, p) => s + p.effectiveRating, 0) / team.length) * 10) / 10;
    return { team1, team2, team1Avg: avg(team1), team2Avg: avg(team2), ratingDiff: Math.abs(avg(team1) - avg(team2)) };
}

function niceDate(dateStr) {
    if (!dateStr) return '';
    try { return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }); }
    catch { return dateStr; }
}

export function generateWhatsAppMessage(game, players, teams) {
    if (!game) return '';
    const sportEmoji = { football: '⚽', padel: '🎾', cricket: '🏏' }[game.sport] || '🏅';
    const confirmed = (game.rsvps || []).filter(r => r.status === 'yes' || r.status === 'checked_in');
    const backup = (game.rsvps || []).filter(r => r.status === 'backup');
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sportsvault.vercel.app';
    const gameLink = `${origin}/?game=${game.id}`;
    const mapLink = game.lat && game.lng ? `https://maps.google.com/?q=${game.lat},${game.lng}` : null;
    const spots = game.maxPlayers - confirmed.length;

    let msg = '';
    msg += `${sportEmoji} *${game.title}*\n`;
    msg += `━━━━━━━━━━━━━━━\n\n`;
    msg += `📅 *${niceDate(game.date)}* at *${game.time}*\n`;
    msg += `📍 *${game.location}*\n`;
    if (game.address) msg += `    ${game.address}\n`;
    if (mapLink) msg += `🗺️ ${mapLink}\n`;
    msg += `\n🏟️ *${game.format}* · ${game.skillLevel}\n`;
    msg += `⏱️ ${game.duration} min · Max ${game.maxPlayers} players\n\n`;
    msg += spots > 0 ? `🟢 *${spots} spot${spots !== 1 ? 's' : ''} left!*\n\n` : `🔴 *Game is full — join waitlist*\n\n`;

    if (confirmed.length > 0) {
        msg += `✅ *Going (${confirmed.length}/${game.maxPlayers})*\n`;
        confirmed.forEach(r => {
            const p = players?.find(pl => pl.id === r.playerId);
            if (p) msg += `  • ${p.name}${r.position ? ` — ${r.position}` : ''}\n`;
        });
        msg += '\n';
    }
    if (backup.length > 0) {
        msg += `⏳ *Backup (${backup.length})*\n`;
        backup.forEach(r => {
            const p = players?.find(pl => pl.id === r.playerId);
            if (p) msg += `  • ${p.name}\n`;
        });
        msg += '\n';
    }
    if (teams) {
        msg += `━━━━━━━━━━━━━━━\n🤖 *Auto-Balanced Teams*\n\n`;
        msg += `🔵 *Team A* (${teams.team1Avg}⭐)\n`;
        teams.team1.forEach(p => { msg += `  • ${p.name} — ${p.position}\n`; });
        msg += `\n🔴 *Team B* (${teams.team2Avg}⭐)\n`;
        teams.team2.forEach(p => { msg += `  • ${p.name} — ${p.position}\n`; });
        msg += '\n';
    }
    msg += `━━━━━━━━━━━━━━━\n👉 *RSVP:* ${gameLink}\n_SportsVault 🏆_`;
    return msg;
}

export function getWhatsAppUrl(message) {
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
