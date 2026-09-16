import { NextResponse } from 'next/server';
import { readData } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestingUserId = searchParams.get('userId');

    const slateData = (await readData('slate.json')) || {};
    const standingsData = (await readData('standings.json')) || [];
    const rawPicks = (await readData('picks.json')) || {};

    const slate = slateData.games || [];
    const now = Date.now();

    // 1. Calculate earliest kickoff to determine if slate is globally locked
    const kickoffTimestamps = slate
      .map((g) => new Date(g.date).getTime())
      .filter((t) => !isNaN(t));

    const earliestKickoff = kickoffTimestamps.length > 0 ? Math.min(...kickoffTimestamps) : 0;
    const isLocked = earliestKickoff > 0 && now >= earliestKickoff;

    // 2. Sanitize Picks: If open, hide all picks except the requester's own picks
    const sanitizedPicks = {};

    Object.entries(rawPicks).forEach(([uid, userPicks]) => {
      if (isLocked) {
        // Locked: Everyone can see everything
        sanitizedPicks[uid] = userPicks;
      } else {
        // Open: Only allow the requesting user to see their own picks
        if (uid === requestingUserId) {
          sanitizedPicks[uid] = userPicks;
        } else {
          // Send an empty array or a dummy marker so the frontend knows they submitted
          // but cannot inspect the selected teams
          sanitizedPicks[uid] = Array.isArray(userPicks) && userPicks.length === 5
            ? [{ hidden: true }, { hidden: true }, { hidden: true }, { hidden: true }, { hidden: true }]
            : [];
        }
      }
    });

    return NextResponse.json({
      slate,
      week: slateData.week || 2,
      standings: standingsData,
      picks: sanitizedPicks,
      isLocked
    });
  } catch (err) {
    console.error('Slate fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}