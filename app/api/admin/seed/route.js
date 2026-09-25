import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '5', 10);

    // 1. Fetch current registered users and standings
    const currentUsers = (await readData('users.json')) || [];
    const currentStandings = (await readData('standings.json')) || [];
    const currentPicks = (await readData('picks.json')) || {};
    const slateData = (await readData('current_slate.json')) || (await readData('slate.json'));
    const games = Array.isArray(slateData) ? slateData : (slateData?.games || []);

    const updatedUsers = [...currentUsers];
    const updatedStandings = [...currentStandings];
    const createdUsers = [];

    // 2. Generate test users (e.g., sim1, sim2...)
    for (let i = 1; i <= count; i++) {
      const testName = `sim${i}`;
      let existingUser = updatedUsers.find((u) => u.name.toLowerCase() === testName);

      if (!existingUser) {
        const newId = `user_sim_${i}_${Date.now().toString().slice(-4)}`;
        existingUser = {
          id: newId,
          name: testName,
          pin: '1234',
          role: 'player',
        };
        updatedUsers.push(existingUser);
        updatedStandings.push({
          id: newId,
          name: testName,
          totalScore: 0,
        });
      }

      createdUsers.push(existingUser);

      // 3. Auto-populate 5 picks for the first 3 test players so we have a mix of states
      if (i <= 3 && games.length >= 5) {
        const simulatedPicks = games.slice(0, 5).map((g) => ({
          gameId: g.id,
          selectedTeamId: (i % 2 === 0) ? g.homeTeam?.id : g.awayTeam?.id,
        }));
        currentPicks[existingUser.id] = simulatedPicks;
      }
    }

    // 4. Save everything back to Redis
    await writeData('users.json', updatedUsers);
    await writeData('standings.json', updatedStandings);
    await writeData('picks.json', currentPicks);

    return NextResponse.json({
      success: true,
      message: `Seeded ${count} test users successfully.`,
      usersCount: updatedUsers.length,
      seededUsers: createdUsers.map((u) => u.name),
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}