import { NextResponse } from 'next/server';
import { readData } from '@/lib/db';
import { getLiveScores } from '@/lib/espn';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    // 1. Read stored state from Redis
    const currentSlate = (await readData('current_slate.json')) || { week: 6, games: [] };
    const history = (await readData('history.json')) || [];
    const activePicks = (await readData('picks.json')) || {};
    const users = (await readData('users.json')) || [];

    const week = parseInt(searchParams.get('week') || String(currentSlate.week || 6), 10);
    const year = parseInt(searchParams.get('year') || '2026', 10);

    // 2. Fetch live ESPN scores for the active week
    const { byTeam = {} } = await getLiveScores({ year, week });

    // Build user directory
    const userStats = {};
    users.forEach((u) => {
      userStats[u.id] = {
        id: u.id,
        name: u.name || u.displayName || u.id,
        wins: 0,
        losses: 0,
        ties: 0,
        points: 0,
        weeklyBreakdown: {},
      };
    });

    // 3. Process completed historical weeks (Weeks 1-4)
    history.forEach((archive) => {
      const pastWeek = archive.week;
      const games = archive.games || [];
      const pastPicks = archive.picks || {};

      games.forEach((game) => {
        if (!game.isCompleted) return;

        Object.entries(pastPicks).forEach(([userId, uPicks]) => {
          if (!userStats[userId]) return;
          if (!userStats[userId].weeklyBreakdown[pastWeek]) {
            userStats[userId].weeklyBreakdown[pastWeek] = 0;
          }

          const userPick = uPicks.find((pk) => pk.gameId === game.gameId);
          if (!userPick || !userPick.selectedTeamId) return;

          if (game.isTie) {
            userStats[userId].ties += 1;
            userStats[userId].points += 0.5;
            userStats[userId].weeklyBreakdown[pastWeek] += 0.5;
          } else if (game.winnerId && String(userPick.selectedTeamId) === String(game.winnerId)) {
            userStats[userId].wins += 1;
            userStats[userId].points += 1;
            userStats[userId].weeklyBreakdown[pastWeek] += 1;
          } else if (game.winnerId) {
            userStats[userId].losses += 1;
          }
        });
      });
    });

    // 4. Process live / active week picks (Week 6)
    const activeGames = currentSlate.games || [];
    activeGames.forEach((game) => {
      // Resolve status using live ESPN feed if available, fallback to stored slate
      const awayAbbrev = game.awayTeam?.abbrev;
      const homeAbbrev = game.homeTeam?.abbrev;
      const liveAway = awayAbbrev ? byTeam[awayAbbrev] : null;
      const liveHome = homeAbbrev ? byTeam[homeAbbrev] : null;

      const isCompleted = liveHome?.isCompleted || liveAway?.isCompleted || game.isCompleted;
      const isTie = liveHome?.isTie || liveAway?.isTie || game.isTie;
      const winnerId = liveHome?.isWinner
        ? game.homeTeam.id
        : liveAway?.isWinner
        ? game.awayTeam.id
        : game.winnerId;

      if (!isCompleted && !liveHome?.isInProgress && !liveAway?.isInProgress) return;

      Object.entries(activePicks).forEach(([userId, uPicks]) => {
        if (!userStats[userId]) return;
        if (!userStats[userId].weeklyBreakdown[week]) {
          userStats[userId].weeklyBreakdown[week] = 0;
        }

        const userPick = uPicks.find((pk) => pk.gameId === game.gameId);
        if (!userPick || !userPick.selectedTeamId) return;

        if (isTie) {
          userStats[userId].ties += 1;
          userStats[userId].points += 0.5;
          userStats[userId].weeklyBreakdown[week] += 0.5;
        } else if (winnerId && String(userPick.selectedTeamId) === String(winnerId)) {
          userStats[userId].wins += 1;
          userStats[userId].points += 1;
          userStats[userId].weeklyBreakdown[week] += 1;
        } else if (isCompleted && winnerId) {
          userStats[userId].losses += 1;
        }
      });
    });

    // 5. Rank players by points descending
    const leaderboard = Object.values(userStats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.wins - a.wins;
    });

    return NextResponse.json({
      week,
      year,
      leaderboard,
    });
  } catch (err) {
    console.error('Error calculating live standings:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}