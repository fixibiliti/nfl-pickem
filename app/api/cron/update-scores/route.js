import { NextResponse } from 'next/server';
import { fetchCurrentNFLWeek, calculateUserScores } from '@/lib/nfl';
import { readData, writeData } from '@/lib/db';

export async function GET() {
  try {
    const espnData = await fetchCurrentNFLWeek();
    const currentSlate = readData('current_slate.json');
    const picks = readData('picks.json') || {};
    const standings = readData('standings.json') || [];

    if (!currentSlate || !currentSlate.games) {
      return NextResponse.json({ message: 'No active slate to score' });
    }

    const updatedGames = currentSlate.games.map(game => {
      const live = (espnData.events || []).find(e => e.id === game.gameId);
      if (!live) return game;
      const comp = live.competitions[0];
      return {
        ...game,
        isCompleted: comp.status.type.completed,
        winnerId: comp.status.type.completed ? comp.competitors.find(c => c.winner)?.id : null
      };
    });

    const updatedStandings = standings.map(player => {
      const userPicks = picks[player.id] || [];
      const points = calculateUserScores(userPicks, updatedGames);
      return {
        ...player,
        totalScore: points
      };
    });

    writeData('standings.json', updatedStandings);
    return NextResponse.json({ success: true, standings: updatedStandings });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}