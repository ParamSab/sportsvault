-- Uncompressed phone-photo uploads stored as multi-MB base64 data URIs broke
-- prod twice: (1) profile photos serialized into the iron-session cookie made
-- session.save() throw (cookie > 4KB) and 500'd every login for those users;
-- (2) games-list responses embedding them exceeded Vercel's 4.5MB limit (413).
-- The client now compresses uploads; null out the legacy giants. Affected
-- users just re-upload their avatar (new uploads are ~50KB).
DO $$
BEGIN
    UPDATE "User" SET photo = NULL
    WHERE photo LIKE 'data:%' AND length(photo) > 200000;

    UPDATE "Game" SET "bookingImage" = NULL
    WHERE "bookingImage" LIKE 'data:%' AND length("bookingImage") > 1000000;
EXCEPTION WHEN OTHERS THEN NULL; -- best-effort cleanup, never block a deploy
END $$;
