import { NextResponse } from 'next/server';
import { fetchCurrentNFLWeek, selectWeeklyGames, calculateUserScores } from '@/lib/nfl';
import { readData, writeData } from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 2 = Tuesday
    
    // 1. Fetch current scoreboard from ESPN
    let espnData = await fetchCurrentNFLWeek();
    const currentSlate = await readData('current_slate.json');
    const picks = (await readData('picks.json')) || {};
    const standings = (await readData('standings.json')) || [];
    const history = (await readData('history.json')) || [];

    let updatedGames = [];

    // 2. UPDATE SCORES FOR ACTIVE SLATE
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
          totalScore: (player.totalScore || 0) + points
        };
      });
      await writeData('standings.json', updatedStandings);

      // Archive into history
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

    // 3. TUESDAY ADVANCEMENT: FORCE NEXT WEEK SLATE
    let newWeekTriggered = false;
    let nextWeekNum = (currentSlate?.week || 1) + 1;

    // Check if all games on the current slate are completed or if it is Tuesday
    const allGamesCompleted = currentSlate?.games?.every(g => g.isCompleted) ?? false;

    if (dayOfWeek === 2 || allGamesCompleted) {
      // Query ESPN explicitly for the upcoming week if the default hasn't advanced
      let targetEvents = espnData.events || [];
      const currentEspnWeek = espnData.week?.number || 1;

      if (currentEspnWeek < nextWeekNum) {
        try {
          const nextWeekRes = await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${nextWeekNum}&seasontype=2`
          );
          if (nextWeekRes.ok) {
            const nextWeekData = await nextWeekRes.json();
            if (nextWeekData.events && nextWeekData.events.length > 0) {
              targetEvents = nextWeekData.events;
            }
          }
        } catch (e) {
          console.error('Failed to fetch future week, falling back:', e);
        }
      }

      const chosenGames = selectWeeklyGames(targetEvents);

      if (chosenGames.length > 0) {
        const newSlate = {
          week: nextWeekNum,
          games: chosenGames
        };

        await writeData('current_slate.json', newSlate);

        // Reset user picks for the new week
        const resetPicks = {
          user_1: [],
          user_2: [],
          user_3: []
        };
        await writeData('picks.json', resetPicks);
        newWeekTriggered = true;
      }
    }

    return NextResponse.json({
      success: true,
      dayOfWeekUTC: dayOfWeek,
      allGamesCompleted,
      newWeekTriggered,
      currentSlateWeek: currentSlate?.week,
      nextWeekNum
    });
  } catch (err) {
    console.error('Cron failure:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}