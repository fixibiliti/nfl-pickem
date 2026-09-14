import { NextResponse } from 'next/server';
import { fetchCurrentNFLWeek, selectWeeklyGames, calculateUserScores } from '@/lib/nfl';
import { readData, writeData } from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sun, 1 = Mon, 2 = Tue, ...
    
    const espnData = await fetchCurrentNFLWeek();
    const currentSlate = await readData('current_slate.json');
    const picks = (await readData('picks.json')) || {};
    const standings = (await readData('standings.json')) || [];
    const history = (await readData('history.json')) || [];

    let updatedGames = [];

    // 1. UPDATE SCORES FOR ACTIVE SLATE
    if (currentSlate && currentSlate.games && currentSlate.games.length > 0) {
      updatedGames = currentSlate.games.map(game => {
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

      // Update current slate with latest scores
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

      // Archive into permanent history
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
    }

    // 2. TUESDAY AUTOMATION: ROLL OVER TO NEW WEEK SLATE
    // If today is Tuesday (UTC day 2), generate the next slate and reset picks
    let newWeekTriggered = false;
    let newSlate = null;

    if (dayOfWeek === 2) {
      const weekNumber = espnData.week?.number || (currentSlate?.week ? currentSlate.week + 1 : 1);
      const chosenGames = selectWeeklyGames(espnData.events || []);

      newSlate = {
        week: weekNumber,
        games: chosenGames
      };

      // Set new slate in DB
      await writeData('current_slate.json', newSlate);

      // Reset active picks for all players for the upcoming slate
      const resetPicks = {
        user_1: [],
        user_2: [],
        user_3: []
      };
      await writeData('picks.json', resetPicks);
      newWeekTriggered = true;
    }

    return NextResponse.json({
      success: true,
      dayOfWeekUTC: dayOfWeek,
      scoresUpdated: updatedGames.length,
      newWeekCreated: newWeekTriggered,
      activeWeek: newSlate ? newSlate.week : currentSlate?.week
    });
  } catch (err) {
    console.error('Smart cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}