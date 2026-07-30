-- Non-football games were created with football spec defaults hardcoded in the
-- create flow ('5-a-side' pitch type, '3G Astro' surface). Null them out so
-- padel/cricket games fall back to their real format in the UI.
DO $$
BEGIN
    UPDATE "Game"
    SET "pitchType" = NULL
    WHERE sport <> 'football' AND "pitchType" LIKE '%a-side%';

    UPDATE "Game"
    SET surface = NULL
    WHERE sport <> 'football' AND surface LIKE '%Astro%';
EXCEPTION WHEN OTHERS THEN NULL; -- best-effort cleanup, never block a deploy
END $$;
