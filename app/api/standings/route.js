import { NextResponse } from 'next/server';
import { readData } from '@/lib/db';
import { getLiveScores } from '@/lib/espn';
import { calculateLeaderboard } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const week = parseInt(searchParams.get('week') || '2', 10);
    const year = parseInt(searchParams.get('year') || '2026', 10);

    // 1. Fetch live scoreboard from ESPN
    const { games = [], byTeam = {} } = await getLiveScores({ year, week });

    // 2. Read stored picks and users
    const allPicks = (await readData('picks.json')) || {};
    const users = (await readData('users.json')) || [];

    // Create a quick lookup map for usernames: { "user123": "Ryan T." }
    const userMap = {};
    if (Array.isArray(users)) {
      for (const u of users) {
        userMap[u.id] = u.name || u.username || u.displayName || u.id;
      }
    } else if (typeof users === 'object') {
      for (const [id, u] of Object.entries(users)) {
        userMap[id] = u.name || u.username || u.displayName || id;
      }
    }

    // 3. Optional: Find the tiebreaker game (last game of the week / Monday Night)
    // If the last game is completed, we extract its total combined points
    let actualTiebreakerTotal = null;
    if (games.length > 0) {
      const lastGame = games[games.length - 1];
      if (lastGame.isCompleted) {
        actualTiebreakerTotal = lastGame.totalPoints;
      }
    }

    // 4. Transform user picks into the format lib/scoring expects
    const submissions = Object.entries(allPicks).map(([userId, pickList]) => {
      // Extract array of team abbreviations: ["KC", "DAL", ...]
      const picks = (pickList || [])
        .map((p) => p.selectedTeamId)
        .filter(Boolean);

      return {
        userId,
        userName: userMap[userId] || `Player ${userId}`,
        picks,
        // If you store tiebreaker guesses per user, it can be passed here:
        tiebreakerPrediction: 0,
      };
    });

    // 5. Calculate live ranked leaderboard
    const leaderboard = calculateLeaderboard(submissions, byTeam, actualTiebreakerTotal);

    return NextResponse.json({
      week,
      year,
      totalGames: games.length,
      leaderboard,
    });
  } catch (err) {
    console.error('Error calculating live standings:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}