import { NextResponse } from 'next/server';
import { readData } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestingUserId = searchParams.get('userId');

    const rawSlateData = (await readData('slate.json')) || [];
    const standingsData = (await readData('standings.json')) || [];
    const rawPicks = (await readData('picks.json')) || {};

    // 1. Normalize Slate: Handle both raw array and object formats
    let slate = [];
    let weekNumber = 2;

    if (Array.isArray(rawSlateData)) {
      slate = rawSlateData;
    } else if (rawSlateData && typeof rawSlateData === 'object') {
      slate = rawSlateData.games || rawSlateData.slate || [];
      weekNumber = rawSlateData.week || 2;
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
        // Locked: All picks visible
        sanitizedPicks[uid] = userPicks;
      } else {
        // Open: Only return selections to the owner
        if (uid === requestingUserId) {
          sanitizedPicks[uid] = userPicks;
        } else {
          // Provide placeholder objects preserving length for status badges
          sanitizedPicks[uid] = Array.isArray(userPicks) && userPicks.length === 5
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