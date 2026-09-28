'use client';

import { useState, useEffect } from 'react';

export default function LiveStandingsWidget({ week = 2, year = 2026 }) {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false); // Collapsed by default

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
    const interval = setInterval(fetchStandings, 60000);
    return () => clearInterval(interval);
  }, [week, year]);

  if (error) return null; // Silently fail so it doesn't interrupt the slate if offline

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all">
      {/* Clickable Header Bar */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 hover:bg-slate-800/60 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">
            Live Standings (Week {week})
          </span>
          {standings.length > 0 && (
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700/60">
              {standings.length} Players
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
          <span>{isOpen ? 'Hide' : 'View'}</span>
          <span className="text-[10px]">{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded Table Content */}
      {isOpen && (
        <div className="border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex justify-between items-center px-4 py-2 bg-slate-950/60 border-b border-slate-800/60">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {loading ? 'Refreshing...' : 'Live Scores'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fetchStandings();
              }}
              className="text-[10px] text-slate-400 hover:text-white"
            >
              ↻ Refresh
            </button>
          </div>

          <div className="divide-y divide-slate-800/50 max-h-72 overflow-y-auto">
            {standings.map((user) => (
              <div
                key={user.userId}
                className="flex items-center justify-between px-4 py-2 hover:bg-slate-800/30 text-xs"
              >
                {/* Rank & Name */}
                <div className="flex items-center gap-2.5 min-w-[100px] truncate">
                  <span
                    className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold ${
                      user.rank === 1
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-500/30'
                        : 'text-slate-400'
                    }`}
                  >
                    {user.rank}
                  </span>
                  <span className="font-medium text-slate-200 truncate">{user.userName}</span>
                </div>

                {/* Team Badges */}
                <div className="flex items-center gap-1">
                  {user.picksDetail.map((pick, i) => {
                    let badgeColor = 'bg-slate-800 text-slate-400 border-slate-700/60';

                    if (pick.result === 'WIN') {
                      badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
                    } else if (pick.result === 'LOSS') {
                      badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/40';
                    } else if (pick.result === 'LIVE') {
                      badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse';
                    }

                    return (
                      <span
                        key={i}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${badgeColor}`}
                      >
                        {pick.team}
                      </span>
                    );
                  })}
                </div>

                {/* Points */}
                <div className="text-right min-w-[45px]">
                  <span className="font-bold text-white text-xs">{user.totalPoints}</span>
                  <span className="text-[10px] text-slate-400 ml-0.5">pts</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}