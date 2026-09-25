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

/**
 * Returns whether a specific kickoff timestamp is locked relative to the effective time.
 */
export function isGameLocked(kickoffTimeIso, effectiveNow) {
  const kickoff = new Date(kickoffTimeIso).getTime();
  return effectiveNow.getTime() >= kickoff;
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