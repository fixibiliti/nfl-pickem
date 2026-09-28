import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';
import { fetchCurrentNFLWeek, generateWeeklySlate } from '@/lib/nfl';
import { getLiveScores } from '@/lib/espn';
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

    // 1b. Ensure every game has odds (from live map or consistent line generator)
    try {
      const liveData = await getLiveScores({ week: weekNumber, seasonType: 2 });
      const liveGameMap = {};
      (liveData.games || []).forEach((g) => {
        if (g.id) liveGameMap[String(g.id)] = g;
      });

      slate = slate.map((game) => {
        const liveGame = liveGameMap[String(game.gameId)];
        let odds = liveGame?.odds || game.odds || null;

        // If no odds from ESPN, generate a deterministic line based on gameId
        if (!odds || (!odds.spread && !odds.overUnder)) {
          const rawId = String(game.gameId || '100');
          const lastDigit = parseInt(rawId.slice(-1), 10) || 3;
          const spreadVal = (lastDigit % 7) + 1.5;
          const favTeam = game.homeTeam?.abbrev || 'HOME';

          odds = {
            spread: `${favTeam} -${spreadVal}`,
            overUnder: `O/U ${42.5 + (lastDigit % 6)}`,
          };
        }

        return {
          ...game,
          odds,
        };
      });
    } catch (e) {
      console.error('Failed to attach live odds to slate:', e);
    }

   // 2. Use Virtual Clock / Effective Date
    const effectiveNow = await getEffectiveDate();
    const effectiveMs = effectiveNow.getTime();

    // Calculate earliest kickoff
    const kickoffTimestamps = slate
      .map((g) => (g && g.date ? new Date(g.date).getTime() : NaN))
      .filter((t) => !isNaN(t));

    const earliestKickoff = kickoffTimestamps.length > 0 ? Math.min(...kickoffTimestamps) : 0;

    // Lock threshold is 1 hour (3,600,000 ms) before the earliest kickoff
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const lockThreshold = earliestKickoff > 0 ? earliestKickoff - ONE_HOUR_MS : 0;
    const isLocked = lockThreshold > 0 && effectiveMs >= lockThreshold;

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