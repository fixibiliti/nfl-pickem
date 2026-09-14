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

    // Match live/final ESPN scores to current slate games
    const updatedGames = currentSlate.games.map(game => {
      const liveEvent = (espnData.events || []).find(e => e.id === game.gameId);
      if (!liveEvent) return game;

      const comp = liveEvent.competitions[0];
      const homeComp = comp.competitors.find(c => c.homeAway === 'home');
      const awayComp = comp.competitors.find(c => c.homeAway === 'away');
      const isCompleted = comp.status?.type?.completed || false;
      const winner = comp.competitors.find(c => c.winner);

      return {
        ...game,
        isCompleted: isCompleted,
        homeScore: homeComp?.score || null,
        awayScore: awayComp?.score || null,
        winnerId: isCompleted && winner ? winner.id : null
      };
    });

    // Save updated scores directly back to the active slate
    await writeData('current_slate.json', {
      ...currentSlate,
      games: updatedGames
    });

    // Update season standings
    const updatedStandings = standings.map(player => {
      const userPicks = picks[player.id] || [];
      const points = calculateUserScores(userPicks, updatedGames);
      return {
        ...player,
        totalScore: points
      };
    });
    await writeData('standings.json', updatedStandings);

    // Save/update the week entry in permanent history
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
    await writeData('history.json', history);

    return NextResponse.json({ 
      success: true, 
      gamesUpdated: updatedGames.length,
      standings: updatedStandings 
    });
  } catch (err) {
    console.error('Update scores error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}