import { NextResponse } from 'next/server';
import { selectWeeklyGames } from '@/lib/nfl';
import { readData, writeData } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // 1. Fetch current slate, standings, and picks
    const currentSlate = await readData('current_slate.json');
    const standings = (await readData('standings.json')) || [];
    const picks = (await readData('picks.json')) || {};
    const history = (await readData('history.json')) || [];

    const finishedWeek = currentSlate?.week || 1;
    const activeGames = currentSlate?.slate || currentSlate?.games || [];

    // 2. Safeguard: Check if all games on the active slate are completed
    const unfinishedGames = activeGames.filter((g) => !g.isCompleted);

    if (unfinishedGames.length > 0 && !force) {
      return NextResponse.json(
        {
          error: `Cannot advance week: Week ${finishedWeek} still has ${unfinishedGames.length} unfinished game(s). All games must be FINAL before rollover.`,
        },
        { status: 400 }
      );
    }

    // 3. Archive completed week if not already archived
    const alreadyArchived = history.some((h) => Number(h.week) === Number(finishedWeek));
    if (!alreadyArchived && activeGames.length > 0) {
      history.push({
        week: finishedWeek,
        archivedAt: new Date().toISOString(),
        games: activeGames,
        standingsSnapshot: standings,
        picksSnapshot: picks,
      });
      await writeData('history.json', history);
    }

    // 4. Clear active picks for the upcoming week
    await writeData('picks.json', {});

    // 5. Advance to the next week
    const nextWeekNumber = finishedWeek + 1;

    // Fetch the exact slate for nextWeekNumber from ESPN
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=${nextWeekNumber}`,
      { cache: 'no-store' }
    );

    let events = [];
    if (res.ok) {
      const data = await res.json();
      events = data.events || [];
    }

    // Generate 5 structured games for the upcoming week
    const newSlate = selectWeeklyGames(events);

    await writeData('current_slate.json', {
      week: nextWeekNumber,
      seasonType: 2,
      year: 2026,
      createdAt: new Date().toISOString(),
      slate: newSlate,
      games: newSlate, // Provide both keys for compatibility
    });

    return NextResponse.json({
      success: true,
      message: `Rolled over from Week ${finishedWeek} to Week ${nextWeekNumber}`,
      week: nextWeekNumber,
      gamesCount: newSlate.length,
    });
  } catch (err) {
    console.error('Cron new-week rollover failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}