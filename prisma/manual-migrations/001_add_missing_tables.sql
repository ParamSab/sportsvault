-- Creates Prisma-schema tables that are missing from production.
-- Idempotent: safe to run on every deploy.
-- NOTE: plain `prisma db push` must NOT be used on this database — the
-- snake_case tables (users, saved_games, game_rsvps) are the live Supabase
-- REST fallback path and db push would drop them.

CREATE TABLE IF NOT EXISTS "Friend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "friendUserId" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Friend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Friend_userId_friendUserId_key" ON "Friend"("userId", "friendUserId");
CREATE INDEX IF NOT EXISTS "Friend_userId_idx" ON "Friend"("userId");

CREATE TABLE IF NOT EXISTS "FriendInvite" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    CONSTRAINT "FriendInvite_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FriendInvite_senderId_idx" ON "FriendInvite"("senderId");
CREATE INDEX IF NOT EXISTS "FriendInvite_friendId_idx" ON "FriendInvite"("friendId");

CREATE TABLE IF NOT EXISTS "Block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "Block_blockerId_idx" ON "Block"("blockerId");

CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Report_status_idx" ON "Report"("status");

-- Foreign keys (wrapped so re-runs don't error)
DO $$ BEGIN
    ALTER TABLE "Friend" ADD CONSTRAINT "Friend_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Friend" ADD CONSTRAINT "Friend_friendUserId_fkey"
        FOREIGN KEY ("friendUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "FriendInvite" ADD CONSTRAINT "FriendInvite_senderId_fkey"
        FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "FriendInvite" ADD CONSTRAINT "FriendInvite_friendId_fkey"
        FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
