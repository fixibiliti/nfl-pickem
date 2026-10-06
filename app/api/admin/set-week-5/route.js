import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';
import { selectWeeklyGames } from '@/lib/nfl';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch real Week 5 matchups directly from ESPN
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=5',
      { cache: 'no-store' }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch ESPN Week 5' }, { status: 500 });
    }

    const data = await res.json();
    const events = data.events || [];
    const week5Slate = selectWeeklyGames(events);

    // 2. Overwrite current_slate.json with Week 5
    await writeData('current_slate.json', {
      week: 5,
      seasonType: 2,
      year: 2026,
      slate: week5Slate,
      updatedAt: new Date().toISOString(),
    });

    // 3. Reset active picks for the new Week 5 slate
    await writeData('picks.json', {});

    // 4. Remove premature Week 5 (and Week 6 if any) from history.json
    const history = (await readData('history.json')) || [];
    const cleanedHistory = history.filter((item) => Number(item.week) < 5);
    await writeData('history.json', cleanedHistory);

    return NextResponse.json({
      success: true,
      message: 'Cleaned history and restored active slate to Week 5',
      week: 5,
      gamesSelected: week5Slate.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}