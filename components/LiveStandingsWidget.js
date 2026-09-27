'use client';

import { useState, useEffect } from 'react';

export default function LiveStandingsWidget({ week = 2, year = 2026 }) {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStandings = async () => {
    try {
      const res = await fetch(`/api/standings?week=${week}&year=${year}`);
      if (!res.ok) throw new Error('Failed to load standings');
      const data = await res.json();
      setStandings(data.leaderboard || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandings();
    // Auto-refresh every 60 seconds during game windows
    const interval = setInterval(fetchStandings, 60000);
    return () => clearInterval(interval);
  }, [week, year]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-400 text-sm animate-pulse">
        Loading live standings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-red-900/50 rounded-xl p-4 text-red-400 text-sm">
        Unable to load standings: {error}
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="font-semibold text-slate-100 text-sm uppercase tracking-wider">
            Live Standings (Week {week})
          </h2>
        </div>
        <button
          onClick={fetchStandings}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
        {standings.map((user) => (
          <div
            key={user.userId}
            className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/40 transition-colors text-sm"
          >
            {/* Rank & User Info */}
            <div className="flex items-center gap-3 min-w-[120px]">
              <span
                className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                  user.rank === 1
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400'
                }`}
              >
                {user.rank}
              </span>
              <span className="font-medium text-slate-200 truncate">{user.userName}</span>
            </div>

            {/* Pick Badges (At-A-Glance Results) */}
            <div className="flex items-center gap-1.5">
              {user.picksDetail.map((pick, i) => {
                let badgeStyle = 'bg-slate-800 text-slate-400 border-slate-700';

                if (pick.result === 'WIN') {
                  badgeStyle = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
                } else if (pick.result === 'LOSS') {
                  badgeStyle = 'bg-rose-500/20 text-rose-400 border-rose-500/40';
                } else if (pick.result === 'LIVE') {
                  badgeStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse';
                }

                return (
                  <span
                    key={i}
                    title={`${pick.team} vs ${pick.opponent} (${pick.score}-${pick.opponentScore}) - ${pick.result}`}
                    className={`px-2 py-0.5 text-xs font-semibold rounded border ${badgeStyle}`}
                  >
                    {pick.team}
                  </span>
                );
              })}
            </div>

            {/* Record / Points */}
            <div className="text-right min-w-[60px]">
              <span className="font-bold text-slate-100">{user.totalPoints}</span>
              <span className="text-xs text-slate-400 ml-1">pts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}