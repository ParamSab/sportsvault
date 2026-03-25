-- Run this SQL in your Supabase project's SQL editor to create the saved_games table.
-- Go to: Supabase Dashboard > SQL Editor > New query

CREATE TABLE IF NOT EXISTS saved_games (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id       TEXT    NOT NULL UNIQUE,  -- matches the Prisma Game.id
  organizer_id  TEXT    NOT NULL,         -- User.id of the signed-in creator
  title         TEXT    NOT NULL,
  sport         TEXT    NOT NULL,
  format        TEXT,
  game_date     TEXT    NOT NULL,         -- e.g. "2025-03-25"
  game_time     TEXT    NOT NULL,         -- e.g. "18:00"
  duration      INT     DEFAULT 90,
  location      TEXT,
  address       TEXT,
  lat           FLOAT,
  lng           FLOAT,
  max_players   INT,
  skill_level   TEXT,
  status        TEXT    DEFAULT 'open',   -- open | completed | cancelled
  visibility    TEXT    DEFAULT 'public',
  price         FLOAT   DEFAULT 0,
  gender        TEXT    DEFAULT 'mixed',
  pitch_type    TEXT,
  surface       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user-history lookups
CREATE INDEX IF NOT EXISTS idx_saved_games_organizer ON saved_games (organizer_id);
CREATE INDEX IF NOT EXISTS idx_saved_games_status    ON saved_games (status);

-- Optional: auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER saved_games_updated_at
  BEFORE UPDATE ON saved_games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- OTP codes table for email verification
CREATE TABLE IF NOT EXISTS otp_codes (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT        NOT NULL,
  code       TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes (email);

-- Users table (fallback when Prisma/PostgreSQL is not configured)
CREATE TABLE IF NOT EXISTS users (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT        NOT NULL,
  email      TEXT        UNIQUE,
  phone      TEXT        UNIQUE,
  photo      TEXT,
  location   TEXT,
  sports     TEXT        DEFAULT '[]',
  positions  TEXT        DEFAULT '{}',
  password   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);

-- RSVPs table (fallback when Prisma/PostgreSQL is not configured)
CREATE TABLE IF NOT EXISTS game_rsvps (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id    TEXT        NOT NULL,
  player_id  TEXT        NOT NULL,
  status     TEXT        NOT NULL,
  position   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_game_rsvp UNIQUE (game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_game_rsvps_game   ON game_rsvps (game_id);
CREATE INDEX IF NOT EXISTS idx_game_rsvps_player ON game_rsvps (player_id);
