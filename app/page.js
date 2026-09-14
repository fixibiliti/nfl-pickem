'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [picks, setPicks] = useState({});
  const [slate, setSlate] = useState([]);
  const [standings, setStandings] = useState([]);
  const [week, setWeek] = useState(1);
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Check Wednesday 11:59 PM lockout rule
  useEffect(() => {
    const now = new Date();
    const day = now.getDay(); // Wed = 3, Thu = 4, Fri = 5, Sat = 6, Sun = 0, Mon = 1
    const hours = now.getHours();
    const mins = now.getMinutes();

    if ([4, 5, 6, 0, 1].includes(day) || (day === 3 && hours === 23 && mins >= 59)) {
      setIsLocked(true);
    }
  }, []);

  // Fetch games & scores after login
  const loadSlateAndScores = async (userId) => {
    try {
      const res = await fetch('/api/slate');
      const data = await res.json();
      setSlate(data.slate || []);
      setStandings(data.standings || []);
      setWeek(data.week || 1);

      // Load existing picks if already submitted
      if (data.picks && data.picks[userId]) {
        const userSaved = {};
        data.picks[userId].forEach(p => {
          userSaved[p.gameId] = p.selectedTeamId;
        });
        setPicks(userSaved);
      }
    } catch (err) {
      console.error('Failed to load slate:', err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin })
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data.user);
      loadSlateAndScores(data.user.id);
    } else {
      setError(data.error || 'Invalid Name or PIN');
    }
  };

  const selectWinner = (gameId, teamId) => {
    if (isLocked) return;
    setPicks(prev => ({ ...prev, [gameId]: teamId }));
  };

  const submitPicks = async () => {
    if (Object.keys(picks).length < 5) {
      alert('Please make a pick for all 5 games!');
      return;
    }
    setLoading(true);
    setSavedSuccess(false);
    const res = await fetch('/api/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, picks })
    });
    setLoading(false);
    if (res.ok) {
      setSavedSuccess(true);
      alert('Picks locked in successfully! Good luck!');
    }
  };

  // 1. LOGIN SCREEN
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-4xl">🏈</span>
            <h1 className="text-2xl font-black text-emerald-400 tracking-tight mt-2">NFL 5-PICK'EM</h1>
            <p className="text-xs text-slate-400 mt-1">Ryan vs. Angi • Season Challenge</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Select Player</label>
              <select
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 text-sm"
              >
                <option value="">Choose your name...</option>
                <option value="Ryan">Ryan</option>
                <option value="Angi">Angi</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">4-Digit PIN</label>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white tracking-widest text-center text-lg focus:outline-none focus:border-emerald-500"
              />
            </div>
            {error && <p className="text-xs text-rose-400 text-center font-semibold">{error}</p>}
            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 rounded-xl transition shadow-lg text-sm tracking-wide active:scale-95"
            >
              ENTER DASHBOARD
            </button>
          </form>
        </div>
      </main>
    );
  }

  // 2. MAIN DASHBOARD SCREEN
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans max-w-lg mx-auto">
      {/* Sticky Mobile Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-base font-black text-emerald-400 tracking-wide">NFL 5-PICK'EM</h1>
          <p className="text-xs text-slate-400">Player: <span className="text-white font-bold">{user.name}</span></p>
        </div>
        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
          isLocked ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        }`}>
          {isLocked ? 'Picks Locked' : 'Picks Open'}
        </span>
      </header>

      {/* Season Standings Card */}
      <section className="p-4 mx-3 my-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
        <h2 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-2.5">Season Leaderboard</h2>
        <div className="grid grid-cols-2 gap-3">
          {standings.map(player => (
            <div
              key={player.id}
              className={`p-3 rounded-xl border text-center ${
                player.name === user.name
                  ? 'bg-slate-800/80 border-emerald-500/50'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <span className="text-xs text-slate-400 font-semibold block">{player.name}</span>
              <span className="text-2xl font-black text-white">
                {player.totalScore} <span className="text-xs font-normal text-slate-500">pts</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Matchup Slate */}
      <main className="px-3 space-y-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Week {week} Slate</span>
          <span className="text-xs font-bold text-emerald-400">{Object.keys(picks).length}/5 Selected</span>
        </div>

        {slate.length === 0 ? (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-sm">
            Loading weekly matchups...
          </div>
        ) : (
          slate.map((game, idx) => {
            const isAwaySelected = picks[game.gameId] === game.awayTeam.id;
            const isHomeSelected = picks[game.gameId] === game.homeTeam.id;

            return (
              <div key={game.gameId} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center text-[11px] text-slate-400 mb-3 border-b border-slate-800/80 pb-2 font-medium">
                  <span className="text-emerald-400 font-semibold">Matchup {idx + 1} • {game.dayOfWeek}</span>
                  <span>
                    {new Date(game.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })} • {new Date(game.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Away Team */}
                  <button
                    type="button"
                    onClick={() => selectWinner(game.gameId, game.awayTeam.id)}
                    disabled={isLocked}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all active:scale-95 ${
                      isAwaySelected
                        ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    {game.awayTeam.logo && (
                      <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="w-9 h-9 object-contain mb-1.5" />
                    )}
                    <span className="font-bold text-sm tracking-wide">{game.awayTeam.abbrev}</span>
                    <span className="text-[10px] text-slate-400 truncate w-full text-center">{game.awayTeam.name}</span>
                  </button>

                  {/* Home Team */}
                  <button
                    type="button"
                    onClick={() => selectWinner(game.gameId, game.homeTeam.id)}
                    disabled={isLocked}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all active:scale-95 ${
                      isHomeSelected
                        ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    {game.homeTeam.logo && (
                      <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="w-9 h-9 object-contain mb-1.5" />
                    )}
                    <span className="font-bold text-sm tracking-wide">{game.homeTeam.abbrev}</span>
                    <span className="text-[10px] text-slate-400 truncate w-full text-center">{game.homeTeam.name}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Lock In Button */}
        <div className="pt-2">
          <button
            onClick={submitPicks}
            disabled={isLocked || Object.keys(picks).length < 5 || loading}
            className="w-full py-4 rounded-xl font-black text-sm bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 shadow-lg transition active:scale-98"
          >
            {loading ? 'SAVING PICKS...' : isLocked ? 'PICKS CLOSED FOR THIS WEEK' : 'LOCK IN PICKS'}
          </button>
        </div>
      </main>
    </div>
  );
}