-- Pre-populates the App Store reviewer demo account with friends, games,
-- RSVPs, messages, and notifications so reviewers can verify all features
-- (App Store guideline 2.1(a) — demo account must include populated content).
-- Idempotent: fixed UUIDs + ON CONFLICT DO NOTHING. Safe to re-run / re-deploy.
-- Demo user id: c71dbc2a-4816-43bd-a060-d2b5575fb0fe

DO $$
DECLARE
  demo  TEXT := 'c71dbc2a-4816-43bd-a060-d2b5575fb0fe';
  f1 TEXT := 'd0000000-0000-4000-8000-000000000001'; -- Arjun
  f2 TEXT := 'd0000000-0000-4000-8000-000000000002'; -- Priya
  f3 TEXT := 'd0000000-0000-4000-8000-000000000003'; -- Rohan
  f4 TEXT := 'd0000000-0000-4000-8000-000000000004'; -- Sana
  f5 TEXT := 'd0000000-0000-4000-8000-000000000005'; -- Vikram
  g1 TEXT := 'e0000000-0000-4000-8000-000000000001'; -- upcoming football (Arjun)
  g2 TEXT := 'e0000000-0000-4000-8000-000000000002'; -- upcoming padel (Priya)
  g3 TEXT := 'e0000000-0000-4000-8000-000000000003'; -- upcoming cricket (demo organizes)
  g4 TEXT := 'e0000000-0000-4000-8000-000000000004'; -- upcoming football (Rohan)
  g5 TEXT := 'e0000000-0000-4000-8000-000000000005'; -- past football (Arjun) completed
  g6 TEXT := 'e0000000-0000-4000-8000-000000000006'; -- past padel (demo) completed
BEGIN
  -- ── Enrich the demo profile itself ──
  UPDATE "User" SET
    positions = '{"football":"Midfielder","cricket":"All-Rounder"}',
    ratings   = '{"football":{"overall":4.2,"count":3,"attrs":{"Dribbling":4,"Passing":5,"Shooting":4,"Positioning":4,"Defending":4,"Attitude":5}},"cricket":{"overall":4.0,"count":2,"attrs":{"Batting":4,"Bowling":4,"Fielding":4,"Attitude":4}}}',
    "trustScore" = 24, "gamesPlayed" = 14, wins = 9, losses = 5,
    location = 'Andheri West, Mumbai', "updatedAt" = NOW()
  WHERE id = demo;

  -- ── Friend users ──
  INSERT INTO "User" (id, name, email, phone, location, sports, positions, ratings, "trustScore", "gamesPlayed", wins, losses, draws, privacy, "createdAt", "updatedAt") VALUES
    (f1, 'Arjun Mehta',  'arjun.demo@sportsvault.co.in',  NULL, 'Andheri West, Mumbai', '["football","cricket"]', '{"football":"Striker","cricket":"Batsman"}', '{"football":{"overall":4.4,"count":5,"attrs":{"Dribbling":5,"Passing":4,"Shooting":5,"Positioning":4,"Defending":3,"Attitude":5}}}', 31, 22, 14, 8, 0, 'public', NOW() - INTERVAL '120 days', NOW()),
    (f2, 'Priya Sharma', 'priya.demo@sportsvault.co.in',  NULL, 'Bandra West, Mumbai',  '["padel","football"]',  '{"padel":"Reves (Left)","football":"Winger"}', '{"padel":{"overall":4.6,"count":7,"attrs":{"Smash":5,"Volley":4,"Bandeja":5,"Positioning":5,"Attitude":5}}}', 38, 19, 13, 6, 0, 'public', NOW() - INTERVAL '95 days', NOW()),
    (f3, 'Rohan Kapoor', 'rohan.demo@sportsvault.co.in',  NULL, 'Powai, Mumbai',        '["football"]',           '{"football":"Centre-Back"}', '{"football":{"overall":4.1,"count":4,"attrs":{"Dribbling":3,"Passing":4,"Shooting":3,"Positioning":5,"Defending":5,"Attitude":4}}}', 27, 16, 9, 7, 0, 'public', NOW() - INTERVAL '80 days', NOW()),
    (f4, 'Sana Khan',    'sana.demo@sportsvault.co.in',   NULL, 'Juhu, Mumbai',         '["padel","cricket"]',    '{"padel":"Drive (Right)","cricket":"All-Rounder"}', '{"padel":{"overall":4.3,"count":3,"attrs":{"Smash":4,"Volley":5,"Bandeja":4,"Positioning":4,"Attitude":5}}}', 22, 11, 7, 4, 0, 'public', NOW() - INTERVAL '60 days', NOW()),
    (f5, 'Vikram Singh', 'vikram.demo@sportsvault.co.in', NULL, 'Andheri East, Mumbai', '["cricket","football"]', '{"cricket":"Bowler","football":"Goalkeeper"}', '{"cricket":{"overall":4.5,"count":6,"attrs":{"Batting":3,"Bowling":5,"Fielding":4,"Attitude":5}}}', 29, 18, 11, 7, 0, 'public', NOW() - INTERVAL '45 days', NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ── Friendships (demo <-> each friend, accepted) ──
  INSERT INTO "Friendship" (id, "userId", "friendId", status, "createdAt") VALUES
    ('fb000000-0000-4000-8000-000000000001', demo, f1, 'accepted', NOW() - INTERVAL '40 days'),
    ('fb000000-0000-4000-8000-000000000002', demo, f2, 'accepted', NOW() - INTERVAL '35 days'),
    ('fb000000-0000-4000-8000-000000000003', demo, f3, 'accepted', NOW() - INTERVAL '30 days'),
    ('fb000000-0000-4000-8000-000000000004', demo, f4, 'accepted', NOW() - INTERVAL '20 days'),
    ('fb000000-0000-4000-8000-000000000005', demo, f5, 'accepted', NOW() - INTERVAL '10 days')
  ON CONFLICT ("userId", "friendId") DO NOTHING;

  -- ── Games (4 upcoming open, 2 past completed) ──
  INSERT INTO "Game" (id, title, sport, format, date, time, duration, location, "maxPlayers", "skillLevel", status, visibility, price, "organizerId", gender, "reminderHours", "createdAt") VALUES
    (g1, 'Sunday Football 7s — Juhu Turf', 'football', '7-a-side', '2026-07-05', '17:30', 90, 'Juhu Beach Turf', 14, 'All Levels', 'open', 'public', 200, f1, 'mixed', 2, NOW() - INTERVAL '5 days'),
    (g2, 'Padel Doubles — Bandra Courts',  'padel',    'Doubles',  '2026-07-06', '19:00', 90, 'Bandra Padel Club', 4, 'Intermediate', 'open', 'public', 400, f2, 'mixed', 2, NOW() - INTERVAL '4 days'),
    (g3, 'Box Cricket Night — Andheri',    'cricket',  'Box Cricket', '2026-07-08', '20:00', 120, 'Smaaash Andheri', 12, 'All Levels', 'open', 'public', 300, demo, 'mixed', 2, NOW() - INTERVAL '3 days'),
    (g4, 'Friday Footy 5s — Powai',        'football', '5-a-side', '2026-07-10', '18:00', 60, 'Powai Sports Arena', 10, 'All Levels', 'open', 'public', 250, f3, 'mixed', 2, NOW() - INTERVAL '2 days'),
    (g5, 'Weeknight Football — Andheri',   'football', '7-a-side', '2026-06-24', '18:00', 90, 'Andheri Sports Club', 14, 'All Levels', 'completed', 'public', 200, f1, 'mixed', 2, NOW() - INTERVAL '8 days'),
    (g6, 'Padel Social — Powai',           'padel',    'Doubles',  '2026-06-21', '10:00', 90, 'Powai Padel Arena', 4, 'All Levels', 'completed', 'public', 350, demo, 'mixed', 2, NOW() - INTERVAL '12 days')
  ON CONFLICT (id) DO NOTHING;

  UPDATE "Game" SET score = '{"team1":3,"team2":2}' WHERE id = g5;
  UPDATE "Game" SET score = '{"team1":6,"team2":4}' WHERE id = g6;

  -- ── RSVPs (demo joined upcoming + past; friends fill the games) ──
  INSERT INTO "Rsvp" (id, "gameId", "playerId", status, position, "paymentStatus", "createdAt", "updatedAt") VALUES
    -- demo's RSVPs
    ('a0000000-0000-4000-8000-000000000001', g1, demo, 'yes', 'Midfielder', 'not_required', NOW() - INTERVAL '5 days', NOW()),
    ('a0000000-0000-4000-8000-000000000002', g2, demo, 'yes', NULL, 'not_required', NOW() - INTERVAL '4 days', NOW()),
    ('a0000000-0000-4000-8000-000000000003', g3, demo, 'yes', 'All-Rounder', 'not_required', NOW() - INTERVAL '3 days', NOW()),
    ('a0000000-0000-4000-8000-000000000004', g4, demo, 'yes', 'Goalkeeper', 'not_required', NOW() - INTERVAL '2 days', NOW()),
    ('a0000000-0000-4000-8000-000000000005', g5, demo, 'yes', 'Midfielder', 'not_required', NOW() - INTERVAL '9 days', NOW()),
    ('a0000000-0000-4000-8000-000000000006', g6, demo, 'yes', NULL, 'not_required', NOW() - INTERVAL '13 days', NOW()),
    -- friends joining games (so spots look filled and player lists populate)
    ('a0000000-0000-4000-8000-000000000011', g1, f1, 'yes', 'Striker', 'not_required', NOW() - INTERVAL '5 days', NOW()),
    ('a0000000-0000-4000-8000-000000000012', g1, f3, 'yes', 'Centre-Back', 'not_required', NOW() - INTERVAL '5 days', NOW()),
    ('a0000000-0000-4000-8000-000000000013', g1, f5, 'yes', 'Goalkeeper', 'not_required', NOW() - INTERVAL '4 days', NOW()),
    ('a0000000-0000-4000-8000-000000000014', g2, f2, 'yes', NULL, 'not_required', NOW() - INTERVAL '4 days', NOW()),
    ('a0000000-0000-4000-8000-000000000015', g2, f4, 'yes', NULL, 'not_required', NOW() - INTERVAL '3 days', NOW()),
    ('a0000000-0000-4000-8000-000000000016', g3, f5, 'yes', 'Bowler', 'not_required', NOW() - INTERVAL '3 days', NOW()),
    ('a0000000-0000-4000-8000-000000000017', g3, f1, 'yes', 'Batsman', 'not_required', NOW() - INTERVAL '2 days', NOW()),
    ('a0000000-0000-4000-8000-000000000018', g4, f3, 'yes', 'Striker', 'not_required', NOW() - INTERVAL '2 days', NOW()),
    ('a0000000-0000-4000-8000-000000000019', g5, f1, 'yes', 'Striker', 'not_required', NOW() - INTERVAL '9 days', NOW()),
    ('a0000000-0000-4000-8000-000000000020', g6, f2, 'yes', NULL, 'not_required', NOW() - INTERVAL '13 days', NOW())
  ON CONFLICT ("gameId", "playerId") DO NOTHING;

  -- ── Thoughts / messages on the demo profile (from friends) ──
  INSERT INTO "Thought" (id, "fromId", "toId", text, "createdAt") VALUES
    ('70000000-0000-4000-8000-000000000001', f1, demo, 'Great organising the Andheri game — well played! Carried us in midfield.', NOW() - INTERVAL '7 days'),
    ('70000000-0000-4000-8000-000000000002', f2, demo, 'Always reliable on the padel court. Let''s run it back this weekend.', NOW() - INTERVAL '5 days'),
    ('70000000-0000-4000-8000-000000000003', f5, demo, 'Solid all-rounder, good attitude on the pitch. 🏏', NOW() - INTERVAL '3 days'),
    ('70000000-0000-4000-8000-000000000004', f3, demo, 'Top defender to play alongside. See you Friday!', NOW() - INTERVAL '1 days')
  ON CONFLICT (id) DO NOTHING;

  -- ── Notifications for the demo account ──
  INSERT INTO "Notification" (id, "userId", title, message, action, "gameId", read, "createdAt") VALUES
    ('40000000-0000-4000-8000-000000000001', demo, 'Game Invite', 'Arjun invited you to Sunday Football 7s — Juhu Turf', NULL, 'e0000000-0000-4000-8000-000000000001', false, NOW() - INTERVAL '2 days'),
    ('40000000-0000-4000-8000-000000000002', demo, 'New Player Joined', 'Priya Sharma is in for Padel Doubles — Bandra Courts', NULL, 'e0000000-0000-4000-8000-000000000002', false, NOW() - INTERVAL '1 days'),
    ('40000000-0000-4000-8000-000000000003', demo, 'Game Reminder', 'Box Cricket Night — Andheri starts soon. See you there!', NULL, 'e0000000-0000-4000-8000-000000000003', true, NOW() - INTERVAL '6 hours'),
    ('40000000-0000-4000-8000-000000000004', demo, 'New Rating', 'You received a new player rating after Weeknight Football.', NULL, NULL, true, NOW() - INTERVAL '6 days')
  ON CONFLICT (id) DO NOTHING;
END $$;
