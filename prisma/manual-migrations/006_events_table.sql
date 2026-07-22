-- First-party product analytics: a lightweight append-only event log.
-- Written server-side via /api/track (Prisma / service_role). No anon access.
-- Idempotent: safe to run on every deploy.

CREATE TABLE IF NOT EXISTS "Event" (
    "id"        TEXT PRIMARY KEY,
    "userId"    TEXT,
    "name"      TEXT NOT NULL,
    "props"     TEXT,                       -- JSON string of extra context
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Event_name_createdAt_idx" ON "Event" ("name", "createdAt");
CREATE INDEX IF NOT EXISTS "Event_userId_idx"          ON "Event" ("userId");
CREATE INDEX IF NOT EXISTS "Event_createdAt_idx"       ON "Event" ("createdAt");

-- Lock down: analytics is written only by the server (service_role bypasses RLS).
-- Enabling RLS with no policies denies all anon/client access.
ALTER TABLE IF EXISTS "Event" ENABLE ROW LEVEL SECURITY;
