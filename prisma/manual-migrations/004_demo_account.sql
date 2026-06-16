-- Creates the Apple App Store reviewer demo account.
-- Idempotent: ON CONFLICT DO NOTHING — safe to re-run.
--   demo@sportsvault.co.in  /  Demo@SportsVault26
--   id: c71dbc2a-4816-43bd-a060-d2b5575fb0fe

DO $$
DECLARE
    demo_id  TEXT := 'c71dbc2a-4816-43bd-a060-d2b5575fb0fe';
    demo_email TEXT := 'demo@sportsvault.co.in';
    demo_name  TEXT := 'SportsVault Demo';
    demo_pass  TEXT := '$2b$10$vH4w9pDOiDuL9g0K.tt.Terq2FqfBuWBJACfLq9a/krc.5uEUYgqe';
    demo_sports TEXT := '["cricket","football"]';
    demo_pos   TEXT := '{}';
    demo_loc   TEXT := 'Mumbai, India';
BEGIN
    -- PascalCase (Prisma) table
    BEGIN
        INSERT INTO "User" (id, name, email, phone, password, photo, location, sports, positions, ratings,
                            "trustScore", "gamesPlayed", wins, losses, draws, "createdAt", "updatedAt")
        VALUES (demo_id, demo_name, demo_email, NULL, demo_pass, NULL, demo_loc,
                demo_sports, demo_pos, '{}', 0, 0, 0, 0, 0, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
            name     = demo_name,
            email    = demo_email,
            password = demo_pass,
            location = demo_loc,
            sports   = demo_sports,
            "updatedAt" = NOW();
    EXCEPTION WHEN undefined_table THEN NULL; END;

    -- snake_case (Supabase) table
    BEGIN
        INSERT INTO users (id, name, email, phone, password, photo, location, sports, positions)
        VALUES (demo_id, demo_name, demo_email, NULL, demo_pass, NULL, demo_loc, demo_sports, demo_pos)
        ON CONFLICT (id) DO UPDATE SET
            name     = demo_name,
            email    = demo_email,
            password = demo_pass,
            location = demo_loc,
            sports   = demo_sports;
    EXCEPTION WHEN undefined_table THEN NULL; END;
END $$;
