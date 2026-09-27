/**
 * lib/scoring.js
 * Evaluates individual player picks and calculates weekly leaderboards.
 */

/**
 * Evaluates a single player's 5 picks against the ESPN byTeam map.
 * 
 * @param {Object} submission - User submission containing picks array
 * @param {Object} byTeam - Normalized team dictionary from lib/espn.js
 * @param {number|null} actualTiebreakerTotal - Final total points of tiebreaker game
 * @returns {Object} Evaluated results with record and pick details
 */
export function evaluateUserSubmission(submission, byTeam = {}, actualTiebreakerTotal = null) {
  const { picks = [], tiebreakerPrediction = 0 } = submission;

  let wins = 0;
  let losses = 0;
  let ties = 0;
  let inProgress = 0;
  let pending = 0;

  const picksDetail = picks.map((teamAbbrev) => {
    const game = byTeam[teamAbbrev];

    // Default if game data hasn't loaded or team has a bye
    if (!game) {
      return {
        team: game.team || teamAbbrev,
        status: 'UNKNOWN',
        score: 0,
        opponentScore: 0,
        opponent: 'TBD',
        result: 'PENDING',
      };
    }

    const { state, won, lost, isTied, score, opponentScore, opponent } = game;

    let result = 'PENDING'; // PENDING, WIN, LOSS, TIE, or LIVE

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
      team: teamAbbrev,
      opponent,
      score,
      opponentScore,
      state, // "pre", "in", "post"
      result, // "WIN", "LOSS", "TIE", "LIVE", "PENDING"
    };
  });

  // Calculate tiebreaker delta (how close they were to the actual score)
  // Lower delta = better guess. Math.abs removes negative signs: |45 - 50| = 5
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
    totalPoints: wins, // Standard rule: 1 point per correct pick
    tiebreakerDelta,
    picksDetail,
  };
}

/**
 * Evaluates all players and sorts them into a live ranked leaderboard.
 * 
 * Ranking Rules:
 * 1. Highest wins (totalPoints) comes first.
 * 2. If tied on wins, the player with the lowest tiebreaker delta ranks higher.
 * 
 * @param {Array} allSubmissions - Array of player submission objects
 * @param {Object} byTeam - Normalized team dictionary from lib/espn.js
 * @param {number|null} actualTiebreakerTotal - Final score of tiebreaker game
 * @returns {Array} Sorted and ranked standings
 */
export function calculateLeaderboard(allSubmissions, byTeam, actualTiebreakerTotal = null) {
  const evaluatedList = allSubmissions.map((sub) =>
    evaluateUserSubmission(sub, byTeam, actualTiebreakerTotal)
  );

  evaluatedList.sort((a, b) => {
    // 1. Sort by total wins descending (highest wins first)
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }

    // 2. Tiebreaker: closest prediction (lowest delta first)
    if (a.tiebreakerDelta !== null && b.tiebreakerDelta !== null) {
      return a.tiebreakerDelta - b.tiebreakerDelta;
    }

    return 0;
  });

  // Assign display rank (1, 2, 3...)
  return evaluatedList.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));
}