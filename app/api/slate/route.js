import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';
import { fetchCurrentNFLWeek, generateWeeklySlate } from '@/lib/nfl';
import { getEffectiveDate, isGameLocked } from '@/lib/clock';

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

    // 2. Use Virtual Clock / Effective Date
    const effectiveNow = await getEffectiveDate();
    const effectiveMs = effectiveNow.getTime();

    // Calculate earliest kickoff
    const kickoffTimestamps = slate
      .map((g) => (g && g.date ? new Date(g.date).getTime() : NaN))
      .filter((t) => !isNaN(t));

    const earliestKickoff = kickoffTimestamps.length > 0 ? Math.min(...kickoffTimestamps) : 0;
    const isLocked = earliestKickoff > 0 && effectiveMs >= earliestKickoff;

    // Create a kickoff lookup map by gameId for per-game reveals
    const kickoffMap = {};
    slate.forEach((g) => {
      if (g.gameId && g.date) {
        kickoffMap[g.gameId] = g.date;
      }
    });

    // 3. Sanitize Picks: Reveal individual picks as each game kicks off
    const sanitizedPicks = {};

    Object.entries(rawPicks).forEach(([uid, userPicks]) => {
      const isOwner = requestingUserId && String(requestingUserId) === String(uid);

      if (isOwner) {
        sanitizedPicks[uid] = userPicks;
      } else {
        // For opponent picks, reveal if that individual game has kicked off
        if (Array.isArray(userPicks)) {
          sanitizedPicks[uid] = userPicks.map((p) => {
            const gameKickoff = kickoffMap[p.gameId];
            const gameHasKickedOff = gameKickoff ? isGameLocked(gameKickoff, effectiveNow) : false;

            if (gameHasKickedOff) {
              return p; // Reveal actual pick
            }
            return {
              gameId: p.gameId,
              selectedTeamId: null, // Hidden until game kickoff
              hidden: true
            };
          });
        } else {
          sanitizedPicks[uid] = [];
        }
      }
    });

    // Attach hasSubmitted directly to each player in standings
    const enrichedStandings = standingsData.map((player) => {
      const picks = rawPicks[player.id];
      const hasSubmitted = Array.isArray(picks) && picks.length === 5;
      return {
        ...player,
        hasSubmitted,
      };
    });

    return NextResponse.json({
      slate,
      week: weekNumber,
      standings: enrichedStandings,
      picks: sanitizedPicks,
      isLocked,
      effectiveTime: effectiveNow.toISOString(),
    });

  } catch (err) {
    console.error('Slate fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}