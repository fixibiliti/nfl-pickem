import { NextResponse } from 'next/server';
import { fetchCurrentNFLWeek, selectWeeklyGames } from '@/lib/nfl';
import { readData, writeData } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // 1. Fetch current slate, standings, and picks
    const currentSlate = await readData('current_slate.json');
    const standings = (await readData('standings.json')) || [];
    const picks = (await readData('picks.json')) || {};
    const history = (await readData('history.json')) || [];

    const finishedWeek = currentSlate?.week || 1;

    // 2. Archive completed week if not already archived
    const alreadyArchived = history.some((h) => h.week === finishedWeek);
    if (!alreadyArchived && currentSlate?.games) {
      history.push({
        week: finishedWeek,
        archivedAt: new Date().toISOString(),
        slate: currentSlate.games,
        standingsSnapshot: standings,
        picksSnapshot: picks,
      });
      await writeData('history.json', history);
    }

    // 3. Clear the active picks for the new week
    await writeData('picks.json', {});

    // 4. Generate the new week's slate using the structured picker
    const espnData = await fetchCurrentNFLWeek();
    const events = espnData?.events || [];
    const newSlate = selectWeeklyGames(events);
    const nextWeekNumber = espnData?.week?.number || finishedWeek + 1;

    await writeData('current_slate.json', {
      week: nextWeekNumber,
      createdAt: new Date().toISOString(),
      games: newSlate,
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