import { NextResponse } from 'next/server';
import { fetchCurrentNFLWeek, selectWeeklyGames, calculateUserScores } from '@/lib/nfl';
import { readData, writeData } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 2 = Tuesday
    
    // 1. Read stored state
    const currentSlate = await readData('current_slate.json');
    const picks = (await readData('picks.json')) || {};
    const standings = (await readData('standings.json')) || [];
    const history = (await readData('history.json')) || [];

    const currentWeekNum = currentSlate?.week || 1;
    let espnData = await fetchCurrentNFLWeek();

    // 2. Finalize & archive current week's scores
    if (currentSlate && currentSlate.games && currentSlate.games.length > 0) {
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

      // Update Season Standings
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
      const existingIdx = history.findIndex(h => h.week === currentWeekNum);
      const weekArchive = {
        week: currentWeekNum,
        games: updatedGames,
        picks: picks
      };
      if (existingIdx >= 0) {
        history[existingIdx] = weekArchive;
      } else {
        history.push(weekArchive);
      }
      await writeData('history.json', history);
    }

    // 3. Roll over to next week
    const allGamesCompleted = currentSlate?.games?.every(g => g.isCompleted) ?? false;
    let nextWeekNum = currentWeekNum;

    if (dayOfWeek === 2 || allGamesCompleted) {
      nextWeekNum = currentWeekNum + 1;
    }

    // Explicitly query ESPN for nextWeekNum using the 2026 calendar year parameter
    let targetEvents = [];
    try {
      const targetRes = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=${nextWeekNum}`,
        { cache: 'no-store' }
      );
      if (targetRes.ok) {
        const data = await targetRes.json();
        targetEvents = data.events || [];
      }
    } catch (e) {
      console.error('Failed to fetch specific week schedule:', e);
    }

    // Fallback if target fetch fails
    if (targetEvents.length === 0) {
      targetEvents = espnData.events || [];
    }

    const chosenGames = selectWeeklyGames(targetEvents);

    if (chosenGames.length > 0) {
      const newSlate = {
        week: nextWeekNum,
        games: chosenGames
      };

      await writeData('current_slate.json', newSlate);

      // Reset picks for the new week
      await writeData('picks.json', {
        user_1: [],
        user_2: [],
        user_3: []
      });
    }

    return NextResponse.json({
      success: true,
      dayOfWeekUTC: dayOfWeek,
      oldWeek: currentWeekNum,
      rolledOverToWeek: nextWeekNum,
      matchupsLoaded: chosenGames.length
    });
  } catch (err) {
    console.error('Cron failure:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}