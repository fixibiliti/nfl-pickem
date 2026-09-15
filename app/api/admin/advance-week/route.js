import { NextResponse } from 'next/server';
import { selectWeeklyGames } from '@/lib/nfl';
import { readData, writeData } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetWeek = parseInt(searchParams.get('week') || '2', 10);

    // 1. Fetch the exact week directly from ESPN API
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=${targetWeek}`,
      { cache: 'no-store' }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch from ESPN' }, { status: 500 });
    }

    const data = await res.json();
    const events = data.events || [];

    if (events.length === 0) {
      return NextResponse.json({ error: `No games found on ESPN for week ${targetWeek}` }, { status: 404 });
    }

    // 2. Select 5 games (with MNF anchored if available)
    const chosenGames = selectWeeklyGames(events);

    // 3. Save new slate to Upstash Redis
    const newSlate = {
      week: targetWeek,
      games: chosenGames
    };
    await writeData('current_slate.json', newSlate);

    // 4. Clear picks for the new week
    await writeData('picks.json', {
      user_1: [],
      user_2: [],
      user_3: []
    });

    return NextResponse.json({
      success: true,
      forcedWeek: targetWeek,
      gamesCount: chosenGames.length,
      firstGame: chosenGames[0]?.name,
      firstGameDate: chosenGames[0]?.date
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}