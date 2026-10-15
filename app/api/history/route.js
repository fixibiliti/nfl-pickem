import { NextResponse } from 'next/server';
import { readData } from '@/lib/db';
import { getEffectiveDate, isGameLocked } from '@/lib/clock';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestingUserId = searchParams.get('userId');

    const history = (await readData('history.json')) || [];
    const users = (await readData('users.json')) || [];
    const effectiveNow = await getEffectiveDate();

    // Sanitize any week that is still in progress or contains unplayed games
    const sanitizedHistory = history.map((archive) => {
      // If all games in this week are completed, picks can be shown publicly
      const isWeekFullyFinal = Array.isArray(archive.games) && archive.games.length > 0 && archive.games.every((g) => g.isCompleted);

      if (isWeekFullyFinal) {
        return archive;
      }

      // If any games are pending or in progress, mask unrevealed opponent picks
      const maskedPicks = {};
      const kickoffMap = {};
      (archive.games || []).forEach((g) => {
        if (g.gameId && g.date) kickoffMap[g.gameId] = g.date;
      });

      Object.entries(archive.picks || {}).forEach(([uid, userPicks]) => {
        const isOwner = requestingUserId && String(requestingUserId) === String(uid);

        if (isOwner) {
          maskedPicks[uid] = userPicks;
        } else {
          maskedPicks[uid] = (userPicks || []).map((p) => {
            const gameDate = kickoffMap[p.gameId];
            const hasStarted = gameDate ? isGameLocked(gameDate, effectiveNow) : false;

            if (hasStarted) {
              return p; // Revealed: individual game has kicked off
            }
            return {
              gameId: p.gameId,
              selectedTeamId: null, // Hidden until game kickoff
              hidden: true,
            };
          });
        }
      });

      return {
        ...archive,
        picks: maskedPicks,
      };
    });

    return NextResponse.json({ history: sanitizedHistory, users });
  } catch (err) {
    console.error('History fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}