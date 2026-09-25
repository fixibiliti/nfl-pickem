import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';
import { getEffectiveDate, isGameLocked } from '@/lib/clock';

export const dynamic = 'force-dynamic';

// Helper to retrieve the game schedule map for kickoff checks
async function getGameKickoffMap(week = '2') {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=${week}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return {};

    const data = await res.json();
    const events = data.events || [];
    const map = {};
    for (const event of events) {
      map[event.id] = event.date;
    }
    return map;
  } catch (e) {
    console.error('Failed to fetch schedule for lockouts:', e);
    return {};
  }
}

// GET: Fetch picks with lockout-aware privacy masking
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const viewerId = searchParams.get('viewerId'); // User viewing the board
    const week = searchParams.get('week') || '2';

    const allPicks = (await readData('picks.json')) || {};
    const kickoffMap = await getGameKickoffMap(week);
    const effectiveNow = await getEffectiveDate();

    // Transform picks: hide picks for opponents if game is not locked yet
    const sanitizedPicks = {};

    for (const [userId, userPicks] of Object.entries(allPicks)) {
      const isOwner = viewerId && String(viewerId) === String(userId);

      sanitizedPicks[userId] = (userPicks || []).map((pick) => {
        const gameKickoff = kickoffMap[pick.gameId];
        const locked = gameKickoff ? isGameLocked(gameKickoff, effectiveNow) : false;

        // If the viewer is the owner OR the game is locked, reveal the pick
        if (isOwner || locked) {
          return {
            ...pick,
            isLocked: locked,
            isRevealed: true,
          };
        }

        // Opponent picks prior to kickoff: mask selection
        return {
          gameId: pick.gameId,
          selectedTeamId: null, // Hidden until kickoff
          isLocked: false,
          isRevealed: false,
        };
      });
    }

    return NextResponse.json({
      picks: sanitizedPicks,
      effectiveTime: effectiveNow.toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Save picks while preventing alterations to locked games
export async function POST(req) {
  try {
    const { userId, picks, week = '2' } = await req.json();
    const allPicks = (await readData('picks.json')) || {};
    const existingUserPicks = allPicks[userId] || [];

    const kickoffMap = await getGameKickoffMap(week);
    const effectiveNow = await getEffectiveDate();

    // Map existing picks by gameId for fast lookup
    const existingPickMap = {};
    for (const p of existingUserPicks) {
      existingPickMap[p.gameId] = p.selectedTeamId;
    }

    // Process new picks and protect locked games
    const updatedUserPicks = [];
    const lockedViolations = [];

    for (const [gameId, selectedTeamId] of Object.entries(picks)) {
      const gameKickoff = kickoffMap[gameId];
      const locked = gameKickoff ? isGameLocked(gameKickoff, effectiveNow) : false;

      if (locked) {
        const priorChoice = existingPickMap[gameId];
        // If they attempted to change or add a pick after kickoff, reject the change
        if (priorChoice !== selectedTeamId) {
          lockedViolations.push(gameId);
        }
        // Keep whatever pick existed prior to lock (or null if none)
        if (priorChoice) {
          updatedUserPicks.push({ gameId, selectedTeamId: priorChoice });
        }
      } else {
        // Game is still open; allow the pick
        updatedUserPicks.push({ gameId, selectedTeamId });
      }
    }

    if (lockedViolations.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot modify picks for locked games: ${lockedViolations.join(', ')}`,
        },
        { status: 400 }
      );
    }

    allPicks[userId] = updatedUserPicks;
    await writeData('picks.json', allPicks);

    return NextResponse.json({ success: true, effectiveTime: effectiveNow.toISOString() });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}