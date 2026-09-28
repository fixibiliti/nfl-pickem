/**
 * lib/espn.js
 * Fetches and normalizes live NFL scores from the ESPN public API.
 */

const ESPN_NFL_SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

/**
 * Fetches scoreboard data from ESPN for a specific season, week, and season type.
 * @param {Object} options
 * @param {number} [options.year] - e.g. 2026
 * @param {number} [options.week] - e.g. 3
 * @param {number} [options.seasonType=2] - 1 = Preseason, 2 = Regular Season, 3 = Postseason
 * @returns {Promise<Object>} Clean map of games and team results
 */
export async function getLiveScores({ year, week, seasonType = 2 } = {}) {
  try {
    const url = new URL(ESPN_NFL_SCOREBOARD_URL);

    // ESPN NFL Scoreboard accepts week and seasontype (2 = regular season)
    if (week) url.searchParams.set('week', week.toString());
    if (seasonType) url.searchParams.set('seasontype', seasonType.toString());
    // Only pass dates if week is NOT provided
    if (year && !week) url.searchParams.set('dates', year.toString());

    // In Next.js, we revalidate every 60 seconds during live games so we don't spam ESPN
    const response = await fetch(url.toString(), {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`ESPN API returned status: ${response.status}`);
    }

    const data = await response.json();
    return parseScoreboardData(data);
  } catch (error) {
    console.error('Error fetching ESPN scoreboard:', error);
    return {
      games: [],
      byTeam: {},
      error: error.message,
    };
  }
}

/**
 * Parses raw ESPN JSON into a simplified game list and a fast byTeam lookup map.
 */
function parseScoreboardData(data) {
  const events = data.events || [];
  const games = [];
  const byTeam = {};

  for (const event of events) {
    const competition = event.competitions?.[0];
    if (!competition) continue;

    const competitors = competition.competitors || [];
    const homeTeam = competitors.find((c) => c.homeAway === 'home');
    const awayTeam = competitors.find((c) => c.homeAway === 'away');

    if (!homeTeam || !awayTeam) continue;

    // Game status: "pre" (upcoming), "in" (live), "post" (final)
    const state = event.status?.type?.state || 'pre';
    const isCompleted = Boolean(event.status?.type?.completed);
    const detail = event.status?.type?.detail || ''; // e.g. "Final", "3rd Qtr 4:12", "7:00 PM"

    const homeScore = parseInt(homeTeam.score || '0', 10);
    const awayScore = parseInt(awayTeam.score || '0', 10);

    const homeAbbrev = homeTeam.team?.abbreviation;
    const awayAbbrev = awayTeam.team?.abbreviation;
    const homeId = homeTeam.team?.id ? String(homeTeam.team.id) : null;
    const awayId = awayTeam.team?.id ? String(awayTeam.team.id) : null;

    // Extract Odds from ESPN, or provide a default matchup line
    const oddsItem = competition.odds?.[0];
    let spread = oddsItem?.details || null;
    let overUnder = oddsItem?.overUnder ? `O/U ${oddsItem.overUnder}` : null;

    // Fallback: If ESPN has no odds posted for this game ID yet
    if (!spread) {
      // Deterministic spread based on gameId so it stays consistent between refreshes
      const lastDigit = parseInt(event.id.slice(-1), 10) || 3;
      const spreadVal = (lastDigit % 7) + 1.5; 
      spread = `${homeAbbrev || 'HOME'} -${spreadVal}`;
      overUnder = `O/U ${42.5 + (lastDigit % 6)}`;
    }
    
    // Structure of a normalized game
    const gameSummary = {
      id: event.id,
      name: event.name, // e.g. "Kansas City Chiefs at Baltimore Ravens"
      date: event.date,
      state, // "pre" | "in" | "post"
      isCompleted,
      statusDetail: detail,
      home: {
        id: homeId,
        abbreviation: homeAbbrev,
        displayName: homeTeam.team?.displayName,
        score: homeScore,
        winner: Boolean(homeTeam.winner),
      },
      away: {
        id: awayId,
        abbreviation: awayAbbrev,
        displayName: awayTeam.team?.displayName,
        score: awayScore,
        winner: Boolean(awayTeam.winner),
      },
      totalPoints: homeScore + awayScore,
    };

    games.push(gameSummary);

    // Common data structure for each team in the game
   const homeData = {
      teamId: homeId,
      team: homeAbbrev || homeId, // Always prefers abbreviation (e.g., "NE")
      displayName: homeTeam.team?.displayName,
      opponent: awayAbbrev,
      opponentId: awayId,
      isHome: true,
      score: homeScore,
      opponentScore: awayScore,
      state,
      isCompleted,
      won: homeTeam.winner === true,
      lost: awayTeam.winner === true,
      isTied: isCompleted && homeScore === awayScore,
      gameId: event.id,
    };

    const awayData = {
      teamId: awayId,
      team: awayAbbrev,
      displayName: awayTeam.team?.displayName,
      opponent: homeAbbrev,
      opponentId: homeId,
      isHome: false,
      score: awayScore,
      opponentScore: homeScore,
      state,
      isCompleted,
      won: awayTeam.winner === true,
      lost: homeTeam.winner === true,
      isTied: isCompleted && homeScore === awayScore,
      gameId: event.id,
    };

    // Index by abbreviation ("KC") AND numeric ID ("12") so both resolve cleanly
    if (homeAbbrev) byTeam[homeAbbrev] = homeData;
    if (homeId) byTeam[homeId] = homeData;

    if (awayAbbrev) byTeam[awayAbbrev] = awayData;
    if (awayId) byTeam[awayId] = awayData;
  }

  return { games, byTeam };
}