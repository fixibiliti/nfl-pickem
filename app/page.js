'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');

  // PIN Change State
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Picks and Views
  const [allPicks, setAllPicks] = useState({});
  const [viewingUserId, setViewingUserId] = useState(null);

  const [slate, setSlate] = useState([]);
  const [standings, setStandings] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [activeTab, setActiveTab] = useState('slate');
  const [week, setWeek] = useState(1);
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Lockout rule check
  useEffect(() => {
    const now = new Date();
    const day = now.getDay();
    const hours = now.getHours();
    const mins = now.getMinutes();

    if ([4, 5, 6, 0, 1].includes(day) || (day === 3 && hours === 23 && mins >= 59)) {
      setIsLocked(true);
    }
  }, []);

  // 2. Persistent Login Check
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('nfl_pickem_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed?.id && !parsed.mustChangePin) {
          setUser(parsed);
          loadSlateAndScores(parsed.id);
          loadHistory();
        }
      }
    } catch (e) {
      console.error('Session restore failed:', e);
    }
  }, []);

  const loadSlateAndScores = async (currentUserId) => {
    try {
      const res = await fetch('/api/slate');
      const data = await res.json();
      setSlate(data.slate || []);
      setStandings(data.standings || []);
      setWeek(data.week || 1);

      const formattedAllPicks = {};
      if (data.picks) {
        Object.entries(data.picks).forEach(([uid, userPickList]) => {
          formattedAllPicks[uid] = {};
          if (Array.isArray(userPickList)) {
            userPickList.forEach((p) => {
              formattedAllPicks[uid][p.gameId] = p.selectedTeamId;
            });
          }
        });
      }
      setAllPicks(formattedAllPicks);
      setViewingUserId(currentUserId);
    } catch (err) {
      console.error('Failed to load slate:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistoryData(data.history || []);
    } catch (err) {
      console.error('Failed to load history:', err);
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
      if (data.user.mustChangePin) {
        setUser(data.user);
        setIsChangingPin(true);
      } else {
        setUser(data.user);
        localStorage.setItem('nfl_pickem_user', JSON.stringify(data.user));
        loadSlateAndScores(data.user.id);
        loadHistory();
      }
    } else {
      setError(data.error || 'Invalid Name or PIN');
    }
  };

  const handleSaveNewPin = async (e) => {
    e.preventDefault();
    setError('');

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError('PIN must be 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/auth/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, newPin })
    });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      const finalUser = { ...user, mustChangePin: false };
      setUser(finalUser);
      setIsChangingPin(false);
      localStorage.setItem('nfl_pickem_user', JSON.stringify(finalUser));
      loadSlateAndScores(finalUser.id);
      loadHistory();
    } else {
      setError(data.error || 'Failed to update PIN');
    }
  };

  const selectWinner = (gameId, teamId) => {
    if (isLocked || viewingUserId !== user?.id) return;

    setAllPicks((prev) => ({
      ...prev,
      [user.id]: {
        ...(prev[user.id] || {}),
        [gameId]: teamId
      }
    }));
  };

  const submitPicks = async () => {
    const myPicks = allPicks[user.id] || {};
    if (Object.keys(myPicks).length < 5) {
      alert('Please make a pick for all 5 games!');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, picks: myPicks })
    });
    setLoading(false);
    if (res.ok) {
      alert('Picks locked in successfully! Good luck!');
    }
  };

  const viewingPlayerName = standings.find((s) => s.id === viewingUserId)?.name || user?.name;
  const currentDisplayedPicks = allPicks[viewingUserId] || {};

  // SCREEN A: MANDATORY FIRST-TIME PIN CREATION
  if (isChangingPin) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-4xl">🔐</span>
            <h1 className="text-xl font-black text-emerald-400 tracking-tight mt-2">CREATE YOUR PIN</h1>
            <p className="text-xs text-slate-400 mt-1">
              Welcome, <span className="text-white font-bold">{user?.name}</span>! Choose a private 4-digit PIN for your picks.
            </p>
          </div>

          <form onSubmit={handleSaveNewPin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">New 4-Digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white tracking-widest text-center text-lg focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white tracking-widest text-center text-lg focus:outline-none focus:border-emerald-500"
              />
            </div>

            {error && <p className="text-xs text-rose-400 text-center font-semibold">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 rounded-xl transition shadow-lg text-sm tracking-wide active:scale-95 disabled:bg-slate-800 disabled:text-slate-600"
            >
              {loading ? 'SAVING PIN...' : 'LOCK IN NEW PIN'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // SCREEN B: STANDARD LOGIN
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-4xl">🏈</span>
            <h1 className="text-2xl font-black text-emerald-400 tracking-tight mt-2">NFL 5-PICK'EM</h1>
            <p className="text-xs text-slate-400 mt-1">Ryan vs. Angi vs. Mary • 2026 Challenge</p>
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
                <option value="Mary">Mary</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">4-Digit PIN (Temporary: 0000)</label>
              <input
                type="password"
                inputMode="numeric"
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

  // SCREEN C: MAIN APPLICATION DASHBOARD
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans max-w-lg mx-auto">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-base font-black text-emerald-400 tracking-wide">NFL 5-PICK'EM</h1>
          <p className="text-xs text-slate-400">
            Player: <span className="text-white font-bold">{user.name}</span>
          </p>
        </div>
        <span
          className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
            isLocked
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          }`}
        >
          {isLocked ? 'Picks Locked' : 'Picks Open'}
        </span>
      </header>

      {/* Navigation Tabs */}
      <div className="flex bg-slate-900 border-b border-slate-800 px-3 pt-2">
        <button
          onClick={() => setActiveTab('slate')}
          className={`flex-1 py-2.5 text-xs font-bold transition border-b-2 text-center ${
            activeTab === 'slate'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Weekly Picks
        </button>
        <button
          onClick={() => {
            setActiveTab('history');
            loadHistory();
          }}
          className={`flex-1 py-2.5 text-xs font-bold transition border-b-2 text-center ${
            activeTab === 'history'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Season Recap 📜
        </button>
      </div>

      {/* Leaderboard */}
      <section className="p-4 mx-3 my-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
        <div className="flex justify-between items-center mb-2.5">
          <h2 className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Season Leaderboard</h2>
          <span className="text-[10px] text-slate-500 font-medium">Click name to view picks</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {standings.map((player) => {
            const isViewingThisPlayer = player.id === viewingUserId;
            return (
              <button
                type="button"
                key={player.id}
                onClick={() => {
                  setViewingUserId(player.id);
                  setActiveTab('slate');
                }}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer active:scale-95 ${
                  isViewingThisPlayer
                    ? 'bg-emerald-500/15 border-emerald-400 ring-1 ring-emerald-400 shadow-md'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <span
                  className={`text-[11px] font-bold block truncate ${
                    isViewingThisPlayer ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {player.name} {player.id === user.id ? '★' : ''}
                </span>
                <span className="text-xl font-black text-white">
                  {player.totalScore || 0} <span className="text-[10px] font-normal text-slate-500">pts</span>
                </span>
                <span className="text-[9px] block mt-0.5 text-slate-500 uppercase tracking-tight">
                  {isViewingThisPlayer ? 'Viewing' : 'Tap to View'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* TAB 1: WEEKLY PICKS SLATE */}
      {activeTab === 'slate' && (
        <main className="px-3 space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Week {week} Slate • <span className="text-emerald-400">{viewingPlayerName}'s Picks</span>
            </span>
            <span className="text-xs font-bold text-emerald-400">
              {Object.keys(currentDisplayedPicks).length}/5 Selected
            </span>
          </div>

          {viewingUserId !== user.id && (
            <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl text-center text-xs text-slate-400 flex items-center justify-between px-3">
              <span>
                Viewing <strong>{viewingPlayerName}</strong>'s slate (Read-Only)
              </span>
              <button
                type="button"
                onClick={() => setViewingUserId(user.id)}
                className="text-emerald-400 font-bold hover:underline text-[11px]"
              >
                Back to My Picks
              </button>
            </div>
          )}

          {slate.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-sm">
              Loading weekly matchups...
            </div>
          ) : (
            slate.map((game, idx) => {
              const isAwaySelected = currentDisplayedPicks[game.gameId] === game.awayTeam.id;
              const isHomeSelected = currentDisplayedPicks[game.gameId] === game.homeTeam.id;
              const canEditThisSlate = !isLocked && viewingUserId === user.id && !game.isCompleted;

              const isAwayWinner = game.isCompleted && game.winnerId === game.awayTeam.id;
              const isHomeWinner = game.isCompleted && game.winnerId === game.homeTeam.id;

              return (
                <div key={game.gameId} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                  {/* Card Header: Matchup & Date or FINAL */}
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mb-3 border-b border-slate-800/80 pb-2 font-medium">
                    <span className="text-emerald-400 font-semibold">
                      Matchup {idx + 1} • {game.dayOfWeek}
                    </span>
                    <div className="flex items-center space-x-2">
                      {game.isCompleted ? (
                        <span className="bg-slate-800 text-amber-400 font-bold px-2 py-0.5 rounded text-[10px] tracking-wider border border-amber-400/20">
                          FINAL
                        </span>
                      ) : (
                        <span>
                          {new Date(game.date).toLocaleDateString('en-US', {
                            month: '2-digit',
                            day: '2-digit',
                            year: '2-digit'
                          })}{' '}
                          • {new Date(game.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 2-Column Grid: Away Team (Left) @ Home Team (Right) */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* AWAY TEAM (LEFT SIDE) */}
                    <button
                      type="button"
                      onClick={() => selectWinner(game.gameId, game.awayTeam.id)}
                      disabled={!canEditThisSlate}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                        canEditThisSlate ? 'active:scale-95 cursor-pointer' : 'cursor-default'
                      } ${
                        isAwaySelected
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2 mb-1.5 min-h-[36px]">
                        {game.awayTeam.logo && (
                          <img
                            src={game.awayTeam.logo}
                            alt={game.awayTeam.name}
                            className="w-9 h-9 object-contain"
                          />
                        )}
                        {game.isCompleted && game.awayScore !== null && game.awayScore !== undefined && (
                          <span
                            className={`text-base font-black px-2 py-0.5 rounded-lg border ${
                              isAwayWinner
                                ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-sm'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            {game.awayScore}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-sm tracking-wide flex items-center gap-1">
                        {game.awayTeam.abbrev}
                        {isAwayWinner && <span className="text-emerald-300 text-xs font-black">✓</span>}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate w-full text-center">
                        {game.awayTeam.name} (Away)
                      </span>
                    </button>

                    {/* HOME TEAM (RIGHT SIDE) */}
                    <button
                      type="button"
                      onClick={() => selectWinner(game.gameId, game.homeTeam.id)}
                      disabled={!canEditThisSlate}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                        canEditThisSlate ? 'active:scale-95 cursor-pointer' : 'cursor-default'
                      } ${
                        isHomeSelected
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2 mb-1.5 min-h-[36px]">
                        {game.homeTeam.logo && (
                          <img
                            src={game.homeTeam.logo}
                            alt={game.homeTeam.name}
                            className="w-9 h-9 object-contain"
                          />
                        )}
                        {game.isCompleted && game.homeScore !== null && game.homeScore !== undefined && (
                          <span
                            className={`text-base font-black px-2 py-0.5 rounded-lg border ${
                              isHomeWinner
                                ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-sm'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            {game.homeScore}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-sm tracking-wide flex items-center gap-1">
                        {game.homeTeam.abbrev}
                        {isHomeWinner && <span className="text-emerald-300 text-xs font-black">✓</span>}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate w-full text-center">
                        {game.homeTeam.name} (Home)
                      </span>
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {viewingUserId === user.id && (
            <div className="pt-2">
              <button
                onClick={submitPicks}
                disabled={isLocked || Object.keys(currentDisplayedPicks).length < 5 || loading}
                className="w-full py-4 rounded-xl font-black text-sm bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 shadow-lg transition active:scale-98"
              >
                {loading ? 'SAVING PICKS...' : isLocked ? 'PICKS CLOSED FOR THIS WEEK' : 'LOCK IN PICKS'}
              </button>
            </div>
          )}
        </main>
      )}

      {/* TAB 2: SEASON RECAP DASHBOARD */}
      {activeTab === 'history' && (
        <main className="px-3 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Picks & Results History</h3>

          {historyData.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-sm">
              No completed weeks archived yet. History will show final scores and everyone's picks once games conclude!
            </div>
          ) : (
            historyData.map((archive) => (
              <div key={archive.week} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="font-black text-emerald-400 text-sm">WEEK {archive.week}</span>
                  <span className="text-[11px] text-slate-400">Final Results</span>
                </div>

                {archive.games?.map((g) => {
                  const ryanPick = archive.picks?.['user_1']?.find((p) => p.gameId === g.gameId)?.selectedTeamId;
                  const angiPick = archive.picks?.['user_2']?.find((p) => p.gameId === g.gameId)?.selectedTeamId;
                  const maryPick = archive.picks?.['user_3']?.find((p) => p.gameId === g.gameId)?.selectedTeamId;

                  const getPickDisplay = (pickId) => {
                    if (!pickId) return '-';
                    const isWinner = g.winnerId && pickId === g.winnerId;
                    const teamAbbrev = pickId === g.homeTeam.id ? g.homeTeam.abbrev : g.awayTeam.abbrev;
                    return (
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          isWinner
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {teamAbbrev} {isWinner ? '✓' : ''}
                      </span>
                    );
                  };

                  return (
                    <div key={g.gameId} className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs">
                      <div className="flex justify-between items-center font-bold text-slate-200 border-b border-slate-800/60 pb-2 mb-2">
                        <span>
                          {g.awayTeam.abbrev} ({g.awayScore || '0'}) @ {g.homeTeam.abbrev} ({g.homeScore || '0'})
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-normal">
                          {g.isCompleted ? 'Final' : 'In Progress'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center pt-1">
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-1">Ryan</span>
                          {getPickDisplay(ryanPick)}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-1">Angi</span>
                          {getPickDisplay(angiPick)}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-1">Mary</span>
                          {getPickDisplay(maryPick)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </main>
      )}
    </div>
  );
}