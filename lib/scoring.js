/**
 * lib/scoring.js
 * Evaluates individual player picks and calculates weekly leaderboards.
 */

// Fallback lookup: Converts ESPN numeric IDs to 2-3 letter abbreviations
const TEAM_ABBREV_BY_ID = {
  '1': 'ATL', '2': 'BUF', '3': 'CHI', '4': 'CIN', '5': 'CLE',
  '6': 'DAL', '7': 'DEN', '8': 'DET', '9': 'GB', '10': 'TEN',
  '11': 'IND', '12': 'KC', '13': 'LV', '14': 'LAR', '15': 'MIA',
  '16': 'MIN', '17': 'NE', '18': 'NO', '19': 'NYG', '20': 'NYJ',
  '21': 'PHI', '22': 'ARI', '23': 'PIT', '24': 'LAC', '25': 'SF',
  '26': 'SEA', '27': 'TB', '28': 'WSH', '29': 'CAR', '30': 'JAX',
  '33': 'BAL', '34': 'HOU'
};

export function evaluateUserSubmission(submission, byTeam = {}, actualTiebreakerTotal = null) {
  const { picks = [], tiebreakerPrediction = 0 } = submission;

  let wins = 0;
  let losses = 0;
  let ties = 0;
  let inProgress = 0;
  let pending = 0;

  const picksDetail = picks.map((teamAbbrevOrId) => {
    const game = byTeam[teamAbbrevOrId];
    
    // Resolve display abbreviation: ESPN map -> dictionary fallback -> original string
    const displayAbbrev = game?.team || TEAM_ABBREV_BY_ID[String(teamAbbrevOrId)] || teamAbbrevOrId;

    if (!game) {
      return {
        team: displayAbbrev,
        status: 'UNKNOWN',
        score: 0,
        opponentScore: 0,
        opponent: 'TBD',
        result: 'PENDING',
      };
    }

    const { state, won, lost, isTied, score, opponentScore, opponent } = game;
    let result = 'PENDING';

    if (state === 'post') {
      if (won) {
        wins += 1;
        result = 'WIN';
      } else if (lost) {
        losses += 1;
        result = 'LOSS';
      } else if (isTied) {
        ties += 1;
        result = 'TIE';
      }
    } else if (state === 'in') {
      inProgress += 1;
      result = 'LIVE';
    } else {
      pending += 1;
      result = 'PENDING';
    }

    return {
      team: displayAbbrev,
      opponent: opponent || 'TBD',
      score,
      opponentScore,
      state,
      result,
    };
  });

  let tiebreakerDelta = null;
  if (actualTiebreakerTotal !== null && tiebreakerPrediction !== undefined) {
    tiebreakerDelta = Math.abs(tiebreakerPrediction - actualTiebreakerTotal);
  }

  return {
    ...submission,
    wins,
    losses,
    ties,
    inProgress,
    pending,
    totalPoints: wins,
    tiebreakerDelta,
    picksDetail,
  };
}

export function calculateLeaderboard(allSubmissions, byTeam, actualTiebreakerTotal = null) {
  const evaluatedList = allSubmissions.map((sub) =>
    evaluateUserSubmission(sub, byTeam, actualTiebreakerTotal)
  );

  evaluatedList.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    if (a.tiebreakerDelta !== null && b.tiebreakerDelta !== null) {
      return a.tiebreakerDelta - b.tiebreakerDelta;
    }
    return 0;
  });

  return evaluatedList.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));
}