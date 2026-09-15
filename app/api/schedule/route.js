import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Cache for 60 seconds

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week') || '2';

    // Query ESPN explicitly for the full slate of that 2026 week
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=${week}`,
      { cache: 'no-store' }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch ESPN schedule' }, { status: 500 });
    }

    const data = await res.json();
    const events = data.events || [];

    // Format into a clean, compact schedule list
    const schedule = events.map(event => {
      const comp = event.competitions[0];
      const homeComp = comp.competitors.find(c => c.homeAway === 'home');
      const awayComp = comp.competitors.find(c => c.homeAway === 'away');

      const gameDate = new Date(event.date);
      const dayOfWeek = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        timeZone: 'America/New_York'
      }).format(gameDate);

      // Extract TV broadcast network if available (e.g., FOX, CBS, NBC, ESPN)
      let broadcast = null;
      if (comp.broadcasts && comp.broadcasts.length > 0) {
        broadcast = comp.broadcasts[0]?.names?.[0] || null;
      }

      return {
        gameId: event.id,
        name: event.name,
        date: event.date,
        dayOfWeek,
        broadcast,
        statusText: comp.status?.type?.shortDetail || 'Scheduled',
        isCompleted: comp.status?.type?.completed || false,
        isInProgress: comp.status?.type?.state === 'in',
        homeTeam: {
          id: homeComp.team.id,
          name: homeComp.team.displayName,
          abbrev: homeComp.team.abbreviation,
          logo: homeComp.team.logo
        },
        awayTeam: {
          id: awayComp.team.id,
          name: awayComp.team.displayName,
          abbrev: awayComp.team.abbreviation,
          logo: awayComp.team.logo
        },
        homeScore: homeComp.score || null,
        awayScore: awayComp.score || null,
        winnerId: comp.status?.type?.completed && comp.competitors.find(c => c.winner)?.id || null
      };
    });

    // Sort strictly chronological by kickoff time
    schedule.sort((a, b) => new Date(a.date) - new Date(b.date));

    return NextResponse.json({
      week: parseInt(week, 10),
      totalGames: schedule.length,
      schedule
    });
  } catch (err) {
    console.error('Schedule fetch failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}