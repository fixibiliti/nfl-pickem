import { NextResponse } from 'next/server';
import { fetchCurrentNFLWeek, calculateUserScores } from '@/lib/nfl';
import { readData, writeData } from '@/lib/db';

export async function GET() {
  try {
    const espnData = await fetchCurrentNFLWeek();
    const currentSlate = await readData('current_slate.json');
    const picks = (await readData('picks.json')) || {};
    const standings = (await readData('standings.json')) || [];
    const history = (await readData('history.json')) || [];

    if (!currentSlate || !currentSlate.games) {
      return NextResponse.json({ message: 'No active slate to score' });
    }

    // Refresh live status for the games on the slate
    const updatedGames = currentSlate.games.map(game => {
      const live = (espnData.events || []).find(e => e.id === game.gameId);
      if (!live) return game;
      const comp = live.competitions[0];
      const homeScore = comp.competitors.find(c => c.homeAway === 'home')?.score;
      const awayScore = comp.competitors.find(c => c.homeAway === 'away')?.score;

      return {
        ...game,
        homeScore: homeScore || '0',
        awayScore: awayScore || '0',
        isCompleted: comp.status.type.completed,
        winnerId: comp.status.type.completed ? comp.competitors.find(c => c.winner)?.id : null
      };
    });

    // Recalculate standings
    const updatedStandings = standings.map(player => {
      const userPicks = picks[player.id] || [];
      const points = calculateUserScores(userPicks, updatedGames);
      return {
        ...player,
        totalScore: points
      };
    });

    // Update history entry for current week
    const currentWeekNum = currentSlate.week || 1;
    const existingIndex = history.findIndex(h => h.week === currentWeekNum);
    const weekArchiveData = {
      week: currentWeekNum,
      games: updatedGames,
      picks: picks
    };

    if (existingIndex >= 0) {
      history[existingIndex] = weekArchiveData;
    } else {
      history.push(weekArchiveData);
    }

    await writeData('standings.json', updatedStandings);
    await writeData('history.json', history);

    return NextResponse.json({ success: true, standings: updatedStandings, historyCount: history.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}