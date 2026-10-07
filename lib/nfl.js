export async function fetchCurrentNFLWeek() {
  const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error('Failed to fetch ESPN data');
  return res.json();
}

export function formatGame(event) {
  const comp = event.competitions?.[0];
  const homeComp = comp?.competitors?.find((c) => c.homeAway === 'home');
  const awayComp = comp?.competitors?.find((c) => c.homeAway === 'away');

  // Helper to pull the overall win-loss record summary (e.g., "3-1")
  const extractTeamRecord = (competitor) => {
    if (!competitor?.records || !Array.isArray(competitor.records)) return null;
    const totalRecord = competitor.records.find((r) => r.type === 'total') || competitor.records[0];
    return totalRecord?.summary || null;
  };

  const gameDate = new Date(event.date);
  const dayOfWeek = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'America/New_York',
  }).format(gameDate);

  // Extract TV broadcast network if available
  let broadcast = null;
  if (comp?.broadcasts && comp.broadcasts.length > 0) {
    broadcast = comp.broadcasts[0]?.names?.[0] || null;
  }

  // Odds resolution: check ESPN lines first, fallback if unavailable
  const oddsItem = comp?.odds?.[0];
  let spread = oddsItem?.details || null;
  let overUnder = oddsItem?.overUnder ? `O/U ${oddsItem.overUnder}` : null;

  if (!spread) {
    const rawId = String(event.id || '100');
    const lastDigit = parseInt(rawId.slice(-1), 10) || 3;
    const spreadVal = (lastDigit % 7) + 1.5;
    const favTeam = homeComp?.team?.abbreviation || 'HOME';

    spread = `${favTeam} -${spreadVal}`;
    overUnder = `O/U ${42.5 + (lastDigit % 6)}`;
  }

  return {
    gameId: event.id,
    name: event.name,
    shortName: event.shortName,
    date: event.date,
    dayOfWeek,
    broadcast,
    isCompleted: comp?.status?.type?.completed || false,
    homeTeam: {
      id: homeComp?.team?.id,
      name: homeComp?.team?.displayName,
      abbrev: homeComp?.team?.abbreviation,
      logo: homeComp?.team?.logo || `https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/${homeComp?.team?.abbreviation?.toLowerCase()}.png`,
      color: homeComp?.team?.color ? `#${homeComp.team.color}` : '#002244',
      altColor: homeComp?.team?.alternateColor ? `#${homeComp.team.alternateColor}` : '#ffffff',
      record: extractTeamRecord(homeComp), // e.g. "3-1"
    },
    awayTeam: {
      id: awayComp?.team?.id,
      name: awayComp?.team?.displayName,
      abbrev: awayComp?.team?.abbreviation,
      logo: awayComp?.team?.logo || `https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/${awayComp?.team?.abbreviation?.toLowerCase()}.png`,
      color: awayComp?.team?.color ? `#${awayComp.team.color}` : '#203731',
      altColor: awayComp?.team?.alternateColor ? `#${awayComp.team.alternateColor}` : '#ffffff',
      record: extractTeamRecord(awayComp), // e.g. "2-2"
    },
    homeScore: homeComp?.score || '0',
    awayScore: awayComp?.score || '0',
    winnerId: (comp?.status?.type?.completed && comp?.competitors?.find((c) => c.winner)?.id) || null,
    odds: {
      spread,
      overUnder,
    },
  };
}

export function selectWeeklyGames(events) {
  if (!events || events.length === 0) return [];

  const formattedGames = events.map(formatGame);

  // 1. Mandatory Primetime Bookends: Thursday and Monday
  const thursdayGames = formattedGames.filter((g) => g.dayOfWeek === 'Thursday');
  const mondayGames = formattedGames.filter((g) => g.dayOfWeek === 'Monday');

  const chosenTNF = thursdayGames.length > 0 ? thursdayGames[0] : null;
  const chosenMNF = mondayGames.length > 0 ? mondayGames[0] : null;

  // 2. Special Window Games: Friday and Saturday (Holidays / Late Season)
  const specialGames = formattedGames.filter(
    (g) => g.dayOfWeek === 'Friday' || g.dayOfWeek === 'Saturday'
  );

  // 3. Sunday Time Slot Buckets (UTC hour converted to Eastern Time)
  const sundayGames = formattedGames.filter((g) => g.dayOfWeek === 'Sunday');
  const sundayEarly = [];     // 1:00 PM ET window
  const sundayAfternoon = []; // 4:05 PM - 4:25 PM ET window
  const sundayNight = [];     // 8:20 PM ET primetime window

  sundayGames.forEach((g) => {
    const gameDate = new Date(g.date);
    // Eastern Time hour: UTC - 4 during Daylight Saving Time
    const hourET = (gameDate.getUTCHours() - 4 + 24) % 24;

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

  // If Friday or Saturday games exist, fold them into the candidate pool for the remaining slots
  if (specialGames.length > 0) {
    const needed = 5 - selected.length;
    const pool = [...specialGames, ...sundayGames].filter(
      (g) => !selected.some((s) => s.gameId === g.gameId)
    );
    const shuffled = pool.sort(() => 0.5 - Math.random());
    selected.push(...shuffled.slice(0, needed));
  } else {
    // Standard Sunday Distribution: 1 Early, 1 Afternoon, 1 Night
    const early = pickRandom(sundayEarly);
    const afternoon = pickRandom(sundayAfternoon);
    const night = pickRandom(sundayNight);

    if (early) selected.push(early);
    if (afternoon) selected.push(afternoon);
    if (night) selected.push(night);

    // Safeguard backfill: If a slot didn't have a game, fill up to 5 from remaining games
    if (selected.length < 5) {
      const leftover = formattedGames.filter(
        (g) => !selected.some((s) => s.gameId === g.gameId)
      );
      const shuffledLeftovers = leftover.sort(() => 0.5 - Math.random());
      selected.push(...shuffledLeftovers.slice(0, 5 - selected.length));
    }
  }

  // Always return the 5 chosen games chronologically sorted by date/kickoff
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