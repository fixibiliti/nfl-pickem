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

  // Use America/New_York so Sunday night games aren't treated as Monday in UTC
  const dayOfWeek = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'America/New_York'
  }).format(gameDate);

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
    winnerId: comp.status?.type?.completed && comp.competitors.find(c => c.winner)?.id || null,
    odds: {
      spread,
      overUnder
    }
  };
}

export function selectWeeklyGames(events) {
  if (!events || events.length === 0) return [];

  const formattedGames = events.map(formatGame);

  // 1. Mandatory Bookends
  const thursdayGames = formattedGames.filter((g) => g.dayOfWeek === 'Thursday');
  const mondayGames = formattedGames.filter((g) => g.dayOfWeek === 'Monday');

  const chosenTNF = thursdayGames.length > 0 ? thursdayGames[0] : null;
  const chosenMNF = mondayGames.length > 0 ? mondayGames[0] : null;

  // 2. Special Window Games (Friday or Saturday)
  const specialGames = formattedGames.filter(
    (g) => g.dayOfWeek === 'Friday' || g.dayOfWeek === 'Saturday'
  );

  // 3. Sunday Time Slot Buckets (based on Eastern Time hours)
  const sundayGames = formattedGames.filter((g) => g.dayOfWeek === 'Sunday');

  const sundayEarly = [];     // ~1:00 PM ET
  const sundayAfternoon = []; // ~4:05 PM - 4:25 PM ET
  const sundayNight = [];     // ~8:20 PM ET

  sundayGames.forEach((g) => {
    const hourET = new Date(g.date).getUTCHours() - 4; // approximate ET hour
    if (hourET < 15) {
      sundayEarly.push(g);
    } else if (hourET >= 15 && hourET < 19) {
      sundayAfternoon.push(g);
    } else {
      sundayNight.push(g);
    }
  });

  const pickRandom = (arr) => (arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null);

  const selected = [];
  if (chosenTNF) selected.push(chosenTNF);
  if (chosenMNF) selected.push(chosenMNF);

  // If there are Friday/Saturday games, mix them into the candidate pool
  if (specialGames.length > 0) {
    const remainingNeeded = 5 - selected.length;
    const pool = [...specialGames, ...sundayGames].filter(
      (g) => !selected.some((s) => s.gameId === g.gameId)
    );
    const shuffled = pool.sort(() => 0.5 - Math.random());
    selected.push(...shuffled.slice(0, remainingNeeded));
  } else {
    // Standard Sunday Spread: 1 Early, 1 Afternoon, 1 Night
    const pickEarly = pickRandom(sundayEarly);
    const pickLate = pickRandom(sundayAfternoon);
    const pickNight = pickRandom(sundayNight);

    if (pickEarly) selected.push(pickEarly);
    if (pickLate) selected.push(pickLate);
    if (pickNight) selected.push(pickNight);

    // If any Sunday window had no games (e.g. no Sunday Night Football), backfill to guarantee 5 games
    if (selected.length < 5) {
      const leftover = formattedGames.filter(
        (g) => !selected.some((s) => s.gameId === g.gameId)
      );
      selected.push(...leftover.slice(0, 5 - selected.length));
    }
  }

  // Always return games sorted chronologically by kickoff date/time
  return selected.sort((a, b) => new Date(a.date) - new Date(b.date));
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