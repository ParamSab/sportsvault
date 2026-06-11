-- Enable Row Level Security on tables exposed via Supabase anon key.
-- Server-side operations use service_role which bypasses RLS automatically.
-- These policies restrict what direct anon/client REST access can do.
-- Idempotent: safe to run on every deploy.

-- Supabase snake_case tables
ALTER TABLE IF EXISTS "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "saved_games" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "game_rsvps" ENABLE ROW LEVEL SECURITY;

-- Prisma PascalCase tables (also accessible via Supabase REST API)
ALTER TABLE IF EXISTS "Friend" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "FriendInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Block" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Report" ENABLE ROW LEVEL SECURITY;

-- Allow anon read of public user profiles (names/photos needed for game rosters)
DO $$ BEGIN
    CREATE POLICY "anon_read_users" ON "users" FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allow anon read of public games only
DO $$ BEGIN
    CREATE POLICY "anon_read_public_games" ON "saved_games" FOR SELECT TO anon USING (visibility = 'public');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allow anon read of RSVPs for public games only
DO $$ BEGIN
    CREATE POLICY "anon_read_public_rsvps" ON "game_rsvps" FOR SELECT TO anon USING (
        EXISTS (SELECT 1 FROM "saved_games" WHERE "saved_games".game_id = "game_rsvps".game_id AND "saved_games".visibility = 'public')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Friend/social tables: no anon access (private data)
-- No SELECT policy = no anon access when RLS is enabled
