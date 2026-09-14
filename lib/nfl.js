export async function fetchCurrentNFLWeek() {
  const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error('Failed to fetch ESPN data');
  return res.json();
}

export function formatGame(event) {
  const comp = event.competitions[0];
  const homeComp = comp.competitors.find(c => c.homeAway === 'home');
  const awayComp = comp.competitors.find(c => c.homeAway === 'away');

  const gameDate = new Date(event.date);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = days[gameDate.getDay()];

  // Helper to ensure valid hex code with #
  const formatColor = (hex, fallback) => (hex ? `#${hex}` : fallback);

  return {
    gameId: event.id,
    name: event.name,
    shortName: event.shortName,
    date: event.date,
    dayOfWeek,
    isCompleted: comp.status?.type?.completed || false,
    homeTeam: {
      id: homeComp.team.id,
      name: homeComp.team.displayName,
      abbrev: homeComp.team.abbreviation,
      logo: homeComp.team.logo,
      color: formatColor(homeComp.team.color, '#059669'),
      altColor: formatColor(homeComp.team.alternateColor, '#ffffff')
    },
    awayTeam: {
      id: awayComp.team.id,
      name: awayComp.team.displayName,
      abbrev: awayComp.team.abbreviation,
      logo: awayComp.team.logo,
      color: formatColor(awayComp.team.color, '#059669'),
      altColor: formatColor(awayComp.team.alternateColor, '#ffffff')
    },
    homeScore: homeComp.score || null,
    awayScore: awayComp.score || null,
    winnerId: comp.status?.type?.completed && comp.competitors.find(c => c.winner)?.id || null
  };
}

export function selectWeeklyGames(events) {
  if (!events || events.length === 0) return [];

  const formattedGames = events.map(formatGame);

  // 1. Identify Monday Night Football
  const mnfGames = formattedGames.filter(g => g.dayOfWeek === 'Monday');
  const otherGames = formattedGames.filter(g => g.dayOfWeek !== 'Monday');

  const selected = [];

  // Pick 1 MNF game if present
  if (mnfGames.length > 0) {
    selected.push(mnfGames[0]);
  }

  // Shuffle remaining games
  const shuffled = [...otherGames].sort(() => 0.5 - Math.random());

  // Fill up to 5 games total
  for (const g of shuffled) {
    if (selected.length < 5) {
      selected.push(g);
    }
  }

  // Sort chronologically by date
  selected.sort((a, b) => new Date(a.date) - new Date(b.date));
  return selected;
}

export function calculateUserScores(userPicks, games) {
  let score = 0;
  if (!Array.isArray(userPicks)) return score;

  for (const pick of userPicks) {
    const game = games.find(g => g.gameId === pick.gameId);
    if (game && game.isCompleted && game.winnerId) {
      if (pick.selectedTeamId === game.winnerId) {
        score += 1;
      }
    }
  }
  return score;
}