const ESPN_NFL_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

export async function fetchCurrentNFLWeek(weekNum = null) {
  const url = weekNum ? `${ESPN_NFL_URL}?seasontype=2&week=${weekNum}` : ESPN_NFL_URL;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch ESPN data');
  return await res.json();
}

export function generateWeeklySlate(espnData) {
  const events = espnData.events || [];
  
  const parsedGames = events.map(event => {
    const comp = event.competitions[0];
    const home = comp.competitors.find(c => c.homeAway === 'home');
    const away = comp.competitors.find(c => c.homeAway === 'away');
    const date = new Date(event.date);

    return {
      gameId: event.id,
      name: event.name,
      shortName: event.shortName,
      date: event.date,
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' }),
      homeTeam: {
        id: home.id,
        name: home.team.displayName,
        abbrev: home.team.abbreviation,
        logo: home.team.logo
      },
      awayTeam: {
        id: away.id,
        name: away.team.displayName,
        abbrev: away.team.abbreviation,
        logo: away.team.logo
      },
      isCompleted: comp.status.type.completed,
      winnerId: comp.status.type.completed 
        ? comp.competitors.find(c => c.winner)?.id || null 
        : null
    };
  });

  // Identify Monday Night Football
  const mnfGame = parsedGames.find(g => g.dayOfWeek === 'Monday');
  const remainingGames = parsedGames.filter(g => g.gameId !== mnfGame?.gameId);

  // Randomly select 4 other games (TNF included in remaining)
  const shuffled = [...remainingGames].sort(() => 0.5 - Math.random());
  const selectedFour = shuffled.slice(0, 4);

  const finalFive = mnfGame ? [mnfGame, ...selectedFour] : shuffled.slice(0, 5);

  return finalFive.sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function calculateUserScores(picks, latestGames) {
  let score = 0;
  picks.forEach(pick => {
    const liveGame = latestGames.find(g => g.gameId === pick.gameId);
    if (liveGame && liveGame.isCompleted) {
      if (liveGame.winnerId && pick.selectedTeamId === liveGame.winnerId) {
        score += 1;
      }
    }
  });
  return score;
}