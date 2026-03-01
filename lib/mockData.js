// ============================================
// SPORTSVAULT — MOCK DATA
// ============================================

export const SPORTS = {
  football: { name: 'Football', emoji: '⚽', color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
  padel: { name: 'Padel', emoji: '🎾', color: '#f97316', gradient: 'linear-gradient(135deg, #f97316, #ea580c)' },
  cricket: { name: 'Cricket', emoji: '🏏', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #eab308)' },
};

export const POSITIONS = {
  football: ['Goalkeeper', 'Centre-Back', 'Full-Back', 'CDM', 'CM', 'CAM', 'Winger', 'Striker'],
  padel: ['Drive (Right)', 'Revés (Left)'],
  cricket: ['Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper', 'Wicketkeeper-Batsman'],
};

export const FORMATS = {
  football: ['5-a-side', '6-a-side', '7-a-side', '8-a-side', '11-a-side'],
  padel: ['Singles', 'Doubles', 'Americano (Round-Robin)'],
  cricket: ['T10', 'T20', 'Box Cricket', '6-a-side Tape Ball', '8-a-side'],
};

export const RATING_ATTRIBUTES = {
  football: ['Dribbling', 'Passing', 'Shooting', 'Positioning', 'Defending', 'Attitude'],
  padel: ['Serve', 'Volleys', 'Consistency', 'Teamwork', 'Court Positioning', 'Power'],
  cricket: ['Batting', 'Bowling', 'Fielding', 'Sportsmanship', 'Game Sense', 'Fitness'],
};

export const TRUST_TIERS = [
  { name: 'Bronze', min: 0, max: 39, color: '#cd7f32', css: 'bronze' },
  { name: 'Silver', min: 40, max: 64, color: '#c0c0c0', css: 'silver' },
  { name: 'Gold', min: 65, max: 84, color: '#ffd700', css: 'gold' },
  { name: 'Platinum', min: 85, max: 100, color: '#e5e4e2', css: 'platinum' },
];

// ---- Players ----
export const PLAYERS = [];

// ---- Games ----
export const GAMES = [];

// ---- Notifications ----
export const NOTIFICATIONS = [];

// ---- Helper Functions ----
export function getPlayer(id) { return PLAYERS.find(p => p.id === id); }
export function getGame(id) { return GAMES.find(g => g.id === id); }
export function getTrustTier(score) { return TRUST_TIERS.find(t => score >= t.min && score <= t.max) || TRUST_TIERS[0]; }
export function getSportColor(sport) { return SPORTS[sport]?.color || '#6366f1'; }
export function getSportEmoji(sport) { return SPORTS[sport]?.emoji || '🏅'; }
export function getInitials(name) { return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2); }
export function getUpcomingGames() { return GAMES.filter(g => g.status === 'open').sort((a, b) => new Date(a.date) - new Date(b.date)); }
export function getPastGames() { return GAMES.filter(g => g.status === 'completed'); }
export function getPlayerGames(playerId) { return GAMES.filter(g => g.rsvps.some(r => r.playerId === playerId)); }
export function spotsLeft(game) { return game.maxPlayers - game.rsvps.filter(r => r.status === 'yes').length; }

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 0 && diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
