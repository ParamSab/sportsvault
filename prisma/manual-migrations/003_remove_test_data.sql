-- Removes QA test residue from the 2026-06-11 production E2E test.
-- Idempotent: DELETEs are no-ops once the rows are gone.
--   Test account: "Param Test" +919867006108  id 77c4e7df-f43d-4df1-b5d9-a88147374787
--   Test game:    "QA Test Game - Please Ignore" id 100494d8-bc8e-4621-a661-5be94a5bb3ff

DO $$
DECLARE
    test_user TEXT := '77c4e7df-f43d-4df1-b5d9-a88147374787';
    test_game TEXT := '100494d8-bc8e-4621-a661-5be94a5bb3ff';
BEGIN
    -- snake_case (Supabase) tables — guard each in case the table doesn't exist
    BEGIN
        EXECUTE format('DELETE FROM game_rsvps WHERE game_id = %L OR player_id = %L', test_game, test_user);
    EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN
        EXECUTE format('DELETE FROM saved_games WHERE game_id = %L OR organizer_id = %L', test_game, test_user);
    EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN
        EXECUTE format('DELETE FROM friendships WHERE user_id = %L OR friend_id = %L', test_user, test_user);
    EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN
        EXECUTE format('DELETE FROM notifications WHERE user_id = %L', test_user);
    EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN
        EXECUTE format('DELETE FROM users WHERE id = %L', test_user);
    EXCEPTION WHEN undefined_table THEN NULL; END;

    -- PascalCase (Prisma) tables
    BEGIN
        EXECUTE format('DELETE FROM "Rsvp" WHERE "gameId" = %L OR "playerId" = %L', test_game, test_user);
    EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN
        EXECUTE format('DELETE FROM "Notification" WHERE "userId" = %L OR "gameId" = %L', test_user, test_game);
    EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN
        EXECUTE format('DELETE FROM "Game" WHERE id = %L OR "organizerId" = %L', test_game, test_user);
    EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN
        EXECUTE format('DELETE FROM "Thought" WHERE "fromId" = %L OR "toId" = %L', test_user, test_user);
    EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN
        EXECUTE format('DELETE FROM "Friendship" WHERE "userId" = %L OR "friendId" = %L', test_user, test_user);
    EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN
        EXECUTE format('DELETE FROM "Friend" WHERE "userId" = %L OR "friendUserId" = %L', test_user, test_user);
    EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN
        EXECUTE format('DELETE FROM "FriendInvite" WHERE "senderId" = %L OR "friendId" = %L', test_user, test_user);
    EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN
        EXECUTE format('DELETE FROM "Block" WHERE "blockerId" = %L OR "blockedId" = %L', test_user, test_user);
    EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN
        EXECUTE format('DELETE FROM "Report" WHERE "reporterId" = %L', test_user);
    EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN
        EXECUTE format('DELETE FROM "User" WHERE id = %L', test_user);
    EXCEPTION WHEN undefined_table THEN NULL; END;
END $$;
