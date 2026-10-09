import { cookies, headers } from 'next/headers';

export const VIRTUAL_CLOCK_COOKIE = 'x-virtual-clock-override';

/**
 * Returns the effective Date object.
 * Priority: Request Header -> Cookie -> Actual System Time.
 */
export async function getEffectiveDate() {
  const headerStore = await headers();
  const headerTime = headerStore.get(VIRTUAL_CLOCK_COOKIE);
  if (headerTime && !isNaN(Date.parse(headerTime))) {
    return new Date(headerTime);
  }

  const cookieStore = await cookies();
  const cookieTime = cookieStore.get(VIRTUAL_CLOCK_COOKIE)?.value;
  if (cookieTime && !isNaN(Date.parse(cookieTime))) {
    return new Date(cookieTime);
  }

  return new Date();
}

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Returns whether a specific game is locked.
 * Rule: Game locks 1 hour prior to scheduled kickoff.
 */
export function isGameLocked(kickoffTimeIso, effectiveNow) {
  if (!kickoffTimeIso) return false;
  const cutoffTime = new Date(kickoffTimeIso).getTime() - ONE_HOUR_MS;
  const nowMs = (effectiveNow instanceof Date ? effectiveNow : new Date(effectiveNow)).getTime();
  return nowMs >= cutoffTime;
}

/**
 * Derives dynamic simulation milestones based on actual game kickoffs for a given week.
 */
export function generateDynamicPresets(kickoffTimes) {
  if (!kickoffTimes || !kickoffTimes.length) return [];

  // Deduplicate and sort timestamps chronologically
  const uniqueTimes = Array.from(
    new Set(kickoffTimes.map((t) => new Date(t).getTime()))
  ).sort((a, b) => a - b);

  const presets = [];

  const firstKickoff = new Date(uniqueTimes[0]);
  const lastKickoff = new Date(uniqueTimes[uniqueTimes.length - 1]);

  // 1. Pre-slate: 1 hour before first kickoff
  presets.push({
    label: 'Pre-Slate (All Open)',
    description: '1 hr before 1st kickoff: All picks open, all opponent picks masked',
    timestamp: new Date(firstKickoff.getTime() - 60 * 60 * 1000).toISOString(),
  });

  // 2. Intermediate points: 5 minutes after each unique kickoff block
  uniqueTimes.forEach((kickoffMs, index) => {
    const kickoffDate = new Date(kickoffMs);
    const simulatedDate = new Date(kickoffMs + 5 * 60 * 1000); // 5 min in

    const dayName = kickoffDate.toLocaleDateString('en-US', { weekday: 'short' });
    const timeStr = kickoffDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    presets.push({
      label: `Wave ${index + 1}: ${dayName} ${timeStr}`,
      description: `5 min post-kickoff: Locks Wave ${index + 1} games & reveals picks`,
      timestamp: simulatedDate.toISOString(),
    });
  });

  // 3. Post-slate: 4 hours after the final game kicks off
  presets.push({
    label: 'Post-Slate (All Finished)',
    description: '4 hrs after final kickoff: All games complete and revealed',
    timestamp: new Date(lastKickoff.getTime() + 4 * 60 * 60 * 1000).toISOString(),
  });

  return presets;
}

/**
 * Evaluates slate-level lock state and determines the next relevant countdown target.
 * 
 * Rules:
 * - Each game locks 1 hour before kickoff.
 * - If gap between consecutive games is >= 24 hours:
 *     - Slate locks during Game N.
 *     - Slate re-opens for remaining games at 4:00 AM on the day after Game N.
 *     - Closes again 1 hour before Game N+1.
 * - If gap is < 24 hours: Slate stays locked.
 */
export function getSlateLockStatus(slateGames, effectiveNow) {
  if (!slateGames || !slateGames.length) {
    return { isLocked: false, nextTargetTime: null, label: 'No Games', gameLocks: [] };
  }

  const nowMs = (effectiveNow instanceof Date ? effectiveNow : new Date(effectiveNow)).getTime();

  // Sort chronological by kickoff
  const sorted = [...slateGames].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Per-game lock status
  const gameLocks = sorted.map((g) => {
    const kickoffMs = new Date(g.date).getTime();
    const lockCutoffMs = kickoffMs - ONE_HOUR_MS;
    return {
      gameId: g.gameId,
      kickoffMs,
      lockCutoffMs,
      isLocked: nowMs >= lockCutoffMs,
    };
  });

  const firstLockMs = gameLocks[0].lockCutoffMs;
  const allLocked = gameLocks.every((g) => g.isLocked);

  // 1. Before the first game cutoff: entire slate is OPEN
  if (nowMs < firstLockMs) {
    return {
      isLocked: false,
      nextTargetTime: new Date(firstLockMs).toISOString(),
      label: 'PICKS OPEN',
      message: 'Picks open until 1 hr before first kickoff',
      gameLocks,
    };
  }

  // 2. All games individually locked: entire slate is LOCKED
  if (allLocked) {
    return {
      isLocked: true,
      nextTargetTime: null,
      label: 'PICKS LOCKED',
      message: 'All games locked for the week',
      gameLocks,
    };
  }

  // 3. In-between games: Check for re-open windows
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentGame = gameLocks[i];
    const nextGame = gameLocks[i + 1];

    if (currentGame.isLocked && !nextGame.isLocked) {
      const gapMs = nextGame.kickoffMs - currentGame.kickoffMs;
      const isGap24Hours = gapMs >= 24 * 60 * 60 * 1000;

      if (isGap24Hours) {
        // Calculate 4:00 AM on the morning following currentGame kickoff
        const currKickoffDate = new Date(currentGame.kickoffMs);
        const unlockDate = new Date(currKickoffDate);
        unlockDate.setDate(unlockDate.getDate() + 1);
        unlockDate.setHours(4, 0, 0, 0); // 4:00 AM local time
        const unlockMs = unlockDate.getTime();

        if (nowMs < unlockMs) {
          // In the lock window between Game N and 4:00 AM next morning
          return {
            isLocked: true,
            nextTargetTime: new Date(unlockMs).toISOString(),
            label: 'PICKS LOCKED',
            message: 'Unlocks tomorrow at 4:00 AM for remaining games',
            gameLocks,
          };
        } else if (nowMs < nextGame.lockCutoffMs) {
          // After 4:00 AM and before next game's cutoff: OPEN for remaining games
          return {
            isLocked: false,
            nextTargetTime: new Date(nextGame.lockCutoffMs).toISOString(),
            label: 'PICKS RE-OPENED',
            message: 'Open for remaining games',
            gameLocks,
          };
        }
      } else {
        // Gap is under 24 hours: stays locked through the next game
        return {
          isLocked: true,
          nextTargetTime: new Date(nextGame.lockCutoffMs).toISOString(),
          label: 'PICKS LOCKED',
          message: 'Picks locked (back-to-back game day)',
          gameLocks,
        };
      }
    }
  }

  return {
    isLocked: true,
    nextTargetTime: null,
    label: 'PICKS LOCKED',
    message: 'Picks closed',
    gameLocks,
  };
}