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
export const PLAYERS = [
  {
    id: 'p1', name: 'Arjun Mehta', phone: '+919876543210', email: 'p1@example.com', photo: null,
    location: 'Bandra West, Mumbai', lat: 19.0596, lng: 72.8295,
    sports: ['football', 'cricket'],
    positions: { football: 'Striker', cricket: 'Batsman' },
    ratings: { football: { overall: 4.2, count: 14, attrs: { Dribbling: 4.5, Passing: 4.0, Shooting: 4.3, Positioning: 4.1, Defending: 3.5, Attitude: 4.8 } }, cricket: { overall: 3.8, count: 11, attrs: { Batting: 4.2, Bowling: 2.8, Fielding: 3.9, Sportsmanship: 4.5, 'Game Sense': 3.8, Fitness: 3.9 } } },
    trustScore: 82, gamesPlayed: 47, wins: 28, losses: 15, draws: 4,
    thoughts: [
      { from: 'p2', text: 'Electric pace and great finishing. Always a pleasure to play with.', date: '2026-02-20' },
      { from: 'p5', text: 'Shows up every time. Reliable and competitive.', date: '2026-02-15' },
    ],
    privacy: 'public', joined: '2025-06-15',
  },
  {
    id: 'p2', name: 'Priya Sharma', phone: '+919876543211', email: 'p2@example.com', photo: null,
    location: 'Andheri, Mumbai', lat: 19.1136, lng: 72.8697,
    sports: ['padel', 'football'],
    positions: { padel: 'Drive (Right)', football: 'CAM' },
    ratings: { padel: { overall: 4.6, count: 18, attrs: { Serve: 4.8, Volleys: 4.7, Consistency: 4.5, Teamwork: 4.9, 'Court Positioning': 4.3, Power: 4.2 } }, football: { overall: 3.9, count: 12, attrs: { Dribbling: 4.1, Passing: 4.3, Shooting: 3.5, Positioning: 3.8, Defending: 3.2, Attitude: 4.5 } } },
    trustScore: 91, gamesPlayed: 63, wins: 38, losses: 18, draws: 7,
    thoughts: [
      { from: 'p1', text: 'Incredible padel player. Best volleys I have seen at this level.', date: '2026-02-18' },
    ],
    privacy: 'public', joined: '2025-04-08',
  },
  {
    id: 'p3', name: 'Rohan Desai', phone: '+919876543212', photo: null,
    location: 'Powai, Mumbai', lat: 19.1176, lng: 72.9060,
    sports: ['cricket', 'football'],
    positions: { cricket: 'All-Rounder', football: 'CM' },
    ratings: { cricket: { overall: 4.4, count: 22, attrs: { Batting: 4.5, Bowling: 4.3, Fielding: 4.2, Sportsmanship: 4.8, 'Game Sense': 4.5, Fitness: 4.2 } }, football: { overall: 3.6, count: 8, attrs: {} } },
    trustScore: 75, gamesPlayed: 55, wins: 30, losses: 20, draws: 5,
    thoughts: [],
    privacy: 'public', joined: '2025-05-20',
  },
  {
    id: 'p4', name: 'Zara Khan', phone: '+919876543213', photo: null,
    location: 'Juhu, Mumbai', lat: 19.0883, lng: 72.8264,
    sports: ['football', 'padel'],
    positions: { football: 'Goalkeeper', padel: 'Revés (Left)' },
    ratings: { football: { overall: 4.7, count: 25, attrs: { Dribbling: 3.0, Passing: 4.2, Shooting: 2.5, Positioning: 4.9, Defending: 4.8, Attitude: 5.0 } }, padel: { overall: 4.1, count: 13, attrs: { Serve: 3.9, Volleys: 4.2, Consistency: 4.3, Teamwork: 4.5, 'Court Positioning': 4.0, Power: 3.8 } } },
    trustScore: 95, gamesPlayed: 72, wins: 44, losses: 22, draws: 6,
    thoughts: [
      { from: 'p1', text: 'Best goalkeeper in the area. Impossible to score against.', date: '2026-02-19' },
      { from: 'p3', text: 'Incredible reflexes and always vocal organizing defense.', date: '2026-02-12' },
    ],
    privacy: 'public', joined: '2025-03-10',
  },
  {
    id: 'p5', name: 'Kabir Singh', phone: '+919876543214', photo: null,
    location: 'Versova, Mumbai', lat: 19.1297, lng: 72.8180,
    sports: ['football', 'cricket', 'padel'],
    positions: { football: 'Winger', cricket: 'Bowler', padel: 'Drive (Right)' },
    ratings: { football: { overall: 3.5, count: 6, attrs: {} }, cricket: { overall: 0, count: 3, attrs: {} }, padel: { overall: 0, count: 2, attrs: {} } },
    trustScore: 45, gamesPlayed: 18, wins: 8, losses: 9, draws: 1,
    thoughts: [],
    privacy: 'public', joined: '2025-11-01',
  },
  {
    id: 'p6', name: 'Ananya Iyer', phone: '+919876543215', photo: null,
    location: 'Colaba, Mumbai', lat: 18.9067, lng: 72.8147,
    sports: ['padel'],
    positions: { padel: 'Drive (Right)' },
    ratings: { padel: { overall: 4.0, count: 10, attrs: { Serve: 4.1, Volleys: 3.8, Consistency: 4.2, Teamwork: 4.3, 'Court Positioning': 3.9, Power: 3.7 } } },
    trustScore: 68, gamesPlayed: 30, wins: 17, losses: 10, draws: 3,
    thoughts: [{ from: 'p2', text: 'Reliable doubles partner. Great communication on court.', date: '2026-02-10' }],
    privacy: 'public', joined: '2025-07-22',
  },
  {
    id: 'p7', name: 'Dev Patel', phone: '+919876543216', photo: null,
    location: 'Malad, Mumbai', lat: 19.1874, lng: 72.8484,
    sports: ['cricket', 'football'],
    positions: { cricket: 'Wicketkeeper-Batsman', football: 'Centre-Back' },
    ratings: { cricket: { overall: 4.1, count: 15, attrs: { Batting: 4.3, Bowling: 2.5, Fielding: 4.5, Sportsmanship: 4.0, 'Game Sense': 4.2, Fitness: 3.8 } }, football: { overall: 3.8, count: 11, attrs: { Dribbling: 3.2, Passing: 4.0, Shooting: 2.8, Positioning: 4.2, Defending: 4.5, Attitude: 3.9 } } },
    trustScore: 58, gamesPlayed: 35, wins: 18, losses: 14, draws: 3,
    thoughts: [],
    privacy: 'friends', joined: '2025-08-14',
  },
  {
    id: 'p8', name: 'Riya Nair', phone: '+919876543217', photo: null,
    location: 'Worli, Mumbai', lat: 19.0176, lng: 72.8150,
    sports: ['football', 'padel'],
    positions: { football: 'Full-Back', padel: 'Revés (Left)' },
    ratings: { football: { overall: 3.9, count: 10, attrs: { Dribbling: 3.5, Passing: 4.0, Shooting: 3.0, Positioning: 4.2, Defending: 4.3, Attitude: 4.5 } }, padel: { overall: 3.7, count: 8, attrs: {} } },
    trustScore: 72, gamesPlayed: 28, wins: 16, losses: 10, draws: 2,
    thoughts: [{ from: 'p4', text: 'Solid defender who never gives up. Great work rate.', date: '2026-02-08' }],
    privacy: 'public', joined: '2025-09-05',
  },
];

// ---- Games ----
const today = new Date();
const fmt = (d) => d.toISOString().split('T')[0];
const future = (days) => { const d = new Date(today); d.setDate(d.getDate() + days); return d; };
const past = (days) => { const d = new Date(today); d.setDate(d.getDate() - days); return d; };

export const GAMES = [
  {
    id: 'g1', sport: 'football', format: '5-a-side', title: 'Monday Night Football',
    location: 'Juhu Beach Turf', address: 'Near Juhu Circle, Mumbai', lat: 19.0883, lng: 72.8264,
    date: fmt(future(1)), time: '19:00', duration: 90,
    organizer: 'p1', maxPlayers: 10, skillLevel: 'Intermediate',
    rsvps: [
      { playerId: 'p1', status: 'yes', position: 'Striker' },
      { playerId: 'p4', status: 'yes', position: 'Goalkeeper' },
      { playerId: 'p2', status: 'yes', position: 'CAM' },
      { playerId: 'p8', status: 'yes', position: 'Full-Back' },
      { playerId: 'p5', status: 'maybe', position: 'Winger' },
      { playerId: 'p3', status: 'maybe', position: 'CM' },
    ],
    status: 'open',
  },
  {
    id: 'g2', sport: 'padel', format: 'Doubles', title: 'Weekend Padel Showdown',
    location: 'Box Hill Padel Club', address: 'Andheri West, Mumbai', lat: 19.1136, lng: 72.8697,
    date: fmt(future(3)), time: '17:30', duration: 60,
    organizer: 'p2', maxPlayers: 4, skillLevel: 'Advanced',
    rsvps: [
      { playerId: 'p2', status: 'yes', position: 'Drive (Right)' },
      { playerId: 'p6', status: 'yes', position: 'Drive (Right)' },
      { playerId: 'p4', status: 'yes', position: 'Revés (Left)' },
    ],
    status: 'open',
  },
  {
    id: 'g3', sport: 'cricket', format: 'T10', title: 'Cricket Blast — T10',
    location: 'Oval Maidan', address: 'Churchgate, Mumbai', lat: 18.9322, lng: 72.8264,
    date: fmt(future(2)), time: '06:30', duration: 120,
    organizer: 'p3', maxPlayers: 16, skillLevel: 'All Levels',
    rsvps: [
      { playerId: 'p3', status: 'yes', position: 'All-Rounder' },
      { playerId: 'p1', status: 'yes', position: 'Batsman' },
      { playerId: 'p7', status: 'yes', position: 'Wicketkeeper-Batsman' },
      { playerId: 'p5', status: 'maybe', position: 'Bowler' },
    ],
    status: 'open',
  },
  {
    id: 'g4', sport: 'football', format: '7-a-side', title: 'Friday Night Lights',
    location: 'Turf Park Powai', address: 'Hiranandani, Powai', lat: 19.1176, lng: 72.9060,
    date: fmt(future(5)), time: '20:00', duration: 90,
    organizer: 'p4', maxPlayers: 14, skillLevel: 'Intermediate',
    rsvps: [
      { playerId: 'p4', status: 'yes', position: 'Goalkeeper' },
      { playerId: 'p7', status: 'yes', position: 'Centre-Back' },
    ],
    status: 'open',
  },
  {
    id: 'g5', sport: 'padel', format: 'Americano (Round-Robin)', title: 'Americano Sunday',
    location: 'PlayAll Sports', address: 'Bandra Kurla Complex', lat: 19.0596, lng: 72.8657,
    date: fmt(future(7)), time: '09:00', duration: 180,
    organizer: 'p6', maxPlayers: 8, skillLevel: 'All Levels',
    rsvps: [
      { playerId: 'p6', status: 'yes', position: 'Drive (Right)' },
      { playerId: 'p2', status: 'maybe', position: 'Drive (Right)' },
    ],
    status: 'open',
  },
  {
    id: 'g6', sport: 'cricket', format: 'Box Cricket', title: 'Box Cricket Showdown',
    location: 'Shivaji Park', address: 'Dadar, Mumbai', lat: 19.0283, lng: 72.8388,
    date: fmt(future(4)), time: '16:00', duration: 90,
    organizer: 'p7', maxPlayers: 12, skillLevel: 'Beginner-Friendly',
    rsvps: [
      { playerId: 'p7', status: 'yes', position: 'Wicketkeeper-Batsman' },
      { playerId: 'p3', status: 'yes', position: 'All-Rounder' },
      { playerId: 'p1', status: 'maybe', position: 'Batsman' },
    ],
    status: 'open',
  },
  // Past games for CV data
  {
    id: 'g7', sport: 'football', format: '5-a-side', title: 'Midweek Kickabout',
    location: 'Juhu Beach Turf', address: 'Near Juhu Circle, Mumbai', lat: 19.0883, lng: 72.8264,
    date: fmt(past(3)), time: '19:00', duration: 90,
    organizer: 'p1', maxPlayers: 10, skillLevel: 'Intermediate',
    rsvps: [
      { playerId: 'p1', status: 'yes', position: 'Striker' },
      { playerId: 'p4', status: 'yes', position: 'Goalkeeper' },
      { playerId: 'p2', status: 'yes', position: 'CAM' },
      { playerId: 'p8', status: 'yes', position: 'Full-Back' },
      { playerId: 'p5', status: 'yes', position: 'Winger' },
    ],
    status: 'completed', winner: 'team1',
    teams: { team1: ['p1', 'p4', 'p5'], team2: ['p2', 'p8', 'p3'] },
  },
  {
    id: 'g8', sport: 'padel', format: 'Doubles', title: 'Tuesday Padel',
    location: 'Box Hill Padel Club', address: 'Andheri West, Mumbai', lat: 19.1136, lng: 72.8697,
    date: fmt(past(5)), time: '18:00', duration: 60,
    organizer: 'p2', maxPlayers: 4, skillLevel: 'Advanced',
    rsvps: [
      { playerId: 'p2', status: 'yes', position: 'Drive (Right)' },
      { playerId: 'p6', status: 'yes', position: 'Drive (Right)' },
      { playerId: 'p4', status: 'yes', position: 'Revés (Left)' },
      { playerId: 'p8', status: 'yes', position: 'Revés (Left)' },
    ],
    status: 'completed', winner: 'team1',
    teams: { team1: ['p2', 'p4'], team2: ['p6', 'p8'] },
  },
];

// ---- Notifications ----
export const NOTIFICATIONS = [
  { id: 'n1', type: 'game_reminder', icon: '⚽', title: 'Game Tomorrow', desc: 'Monday Night Football starts at 7:00 PM', time: '1h ago', read: false, sport: 'football' },
  { id: 'n2', type: 'friend_activity', icon: '👥', title: 'Priya joined a game', desc: 'Weekend Padel Showdown — 3 spots left', time: '2h ago', read: false, sport: 'padel' },
  { id: 'n3', type: 'rating', icon: '⭐', title: 'New Rating Received', desc: 'Someone rated your football skills', time: '5h ago', read: true, sport: 'football' },
  { id: 'n4', type: 'trust', icon: '🛡️', title: 'Trust Score Updated', desc: 'You reached Gold tier! Keep it up.', time: '1d ago', read: true, sport: null },
  { id: 'n5', type: 'maybe_reminder', icon: '🔔', title: 'Confirm Your Spot', desc: 'Cricket Blast T10 is tomorrow. Are you in?', time: '3h ago', read: false, sport: 'cricket' },
  { id: 'n6', type: 'feedback', icon: '💬', title: 'New Thought on Your Profile', desc: 'Arjun left a comment about your game', time: '6h ago', read: true, sport: null },
  { id: 'n7', type: 'game_created', icon: '🏏', title: 'Nearby Game Created', desc: 'Box Cricket Showdown at Shivaji Park', time: '8h ago', read: true, sport: 'cricket' },
];

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
