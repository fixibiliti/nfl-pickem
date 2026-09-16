import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';
import { fetchCurrentNFLWeek, generateWeeklySlate } from '@/lib/nfl';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestingUserId = searchParams.get('userId');

    // 1. Read current_slate.json (with fallback to slate.json)
    let rawSlateData = (await readData('current_slate.json')) || (await readData('slate.json'));
    const standingsData = (await readData('standings.json')) || [];
    const rawPicks = (await readData('picks.json')) || {};

    let slate = [];
    let weekNumber = 2;

    if (rawSlateData) {
      if (Array.isArray(rawSlateData)) {
        slate = rawSlateData;
      } else if (typeof rawSlateData === 'object') {
        slate = rawSlateData.games || rawSlateData.slate || [];
        weekNumber = rawSlateData.week || 2;
      }
    }

    // Auto-heal: If Redis has no slate yet, generate it on the fly
    if (!slate || slate.length === 0) {
      try {
        const espnData = await fetchCurrentNFLWeek();
        const newSlate = generateWeeklySlate(espnData);
        weekNumber = espnData.week?.number || 2;

        if (newSlate && newSlate.length > 0) {
          slate = newSlate;
          await writeData('current_slate.json', {
            week: weekNumber,
            createdAt: new Date().toISOString(),
            games: newSlate
          });
        }
      } catch (genErr) {
        console.error('Failed to auto-generate slate:', genErr);
      }
    }

    const now = Date.now();

    // 2. Calculate earliest kickoff
    const kickoffTimestamps = slate
      .map((g) => (g && g.date ? new Date(g.date).getTime() : NaN))
      .filter((t) => !isNaN(t));

    const earliestKickoff = kickoffTimestamps.length > 0 ? Math.min(...kickoffTimestamps) : 0;
    const isLocked = earliestKickoff > 0 && now >= earliestKickoff;

    // 3. Sanitize Picks: Hide opponent picks if slate is still open
    const sanitizedPicks = {};

    Object.entries(rawPicks).forEach(([uid, userPicks]) => {
      if (isLocked) {
        sanitizedPicks[uid] = userPicks;
      } else {
        if (uid === requestingUserId) {
          sanitizedPicks[uid] = userPicks;
        } else {
          sanitizedPicks[uid] =
            Array.isArray(userPicks) && userPicks.length === 5
              ? [{ hidden: true }, { hidden: true }, { hidden: true }, { hidden: true }, { hidden: true }]
              : [];
        }
      }
    });

    return NextResponse.json({
      slate,
      week: weekNumber,
      standings: standingsData,
      picks: sanitizedPicks,
      isLocked
    });
  } catch (err) {
    console.error('Slate fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}