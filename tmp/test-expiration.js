
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testExpiration() {
    console.log("--- Testing Game Expiration ---");

    // 1. Create a game that started 25 hours ago
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 25);
    const dateStr = yesterday.toISOString().split('T')[0];
    const timeStr = yesterday.toTimeString().split(' ')[0].substring(0, 5);

    console.log(`Creating test game for ${dateStr} at ${timeStr}`);

    const testGame = await prisma.game.create({
        data: {
            title: 'Test Expired Game',
            sport: 'football',
            format: '5-a-side',
            date: dateStr,
            time: timeStr,
            duration: 90,
            location: 'Test Pitch',
            maxPlayers: 10,
            skillLevel: 'Intermediate',
            status: 'open',
            organizerId: (await prisma.user.findFirst()).id // Use any existing user
        }
    });

    console.log(`Created game ID: ${testGame.id} with status: ${testGame.status}`);

    // 2. Simulate the API call logic (GET /api/games logic)
    console.log("Simulating GET /api/games logic...");
    const now = new Date();
    const openGames = await prisma.game.findMany({ where: { status: 'open', id: testGame.id } });

    for (const g of openGames) {
        const gameStart = new Date(`${g.date}T${g.time || '00:00'}`);
        const expiry = new Date(gameStart.getTime() + (24 * 60 * 60 * 1000));
        console.log(`Game Start: ${gameStart.toISOString()}`);
        console.log(`Expiry Time: ${expiry.toISOString()}`);
        console.log(`Current Time: ${now.toISOString()}`);

        if (now > expiry) {
            console.log("Game is expired! Updating status to 'completed'...");
            await prisma.game.update({ where: { id: g.id }, data: { status: 'completed' } });
        } else {
            console.log("Game is NOT expired.");
        }
    }

    // 3. Verify status update
    const updatedGame = await prisma.game.findUnique({ where: { id: testGame.id } });
    console.log(`Final Game Status: ${updatedGame.status}`);

    if (updatedGame.status === 'completed') {
        console.log("✅ SUCCESS: Game was correctly expired.");
    } else {
        console.log("❌ FAILURE: Game was not expired.");
    }

    // Cleanup
    await prisma.game.delete({ where: { id: testGame.id } });
    await prisma.$disconnect();
}

testExpiration().catch(e => {
    console.error(e);
    process.exit(1);
});
