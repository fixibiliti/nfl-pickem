'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [picks, setPicks] = useState({});
  const [slate, setSlate] = useState([]);
  const [standings, setStandings] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check Wednesday 11:59 PM deadline
  useEffect(() => {
    const now = new Date();
    const day = now.getDay();
    const hours = now.getHours();
    const mins = now.getMinutes();
    // Wednesday = 3, Thursday = 4, Friday = 5, Saturday = 6, Sunday = 0, Monday = 1
    if ([4, 5, 6, 0, 1].includes(day) || (day === 3 && hours === 23 && mins >= 59)) {
      setIsLocked(true);
    }
  }, []);

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
      alert('Please select a winner for all 5 matchups before submitting!');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, picks })
    });
    setLoading(false);
    if (res.ok) {
      alert('Picks locked in successfully! Good luck this week!');
    }
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-3xl">🏈</span>
            <h1 className="text-2xl font-black text-emerald-400 tracking-tight mt-2">NFL 5-PICK'EM</h1>
            <p className="text-xs text-slate-400 mt-1">Ryan vs. Angi • 2026 Season Challenge</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Select Player</label>
              <select
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 text-sm"
              >
                <option value="">Choose...</option>
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
            {error && <p className="text-xs text-rose-400 text-center font-medium">{error}</p>}
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans">
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-base font-black text-emerald-400 tracking-wide">NFL 5-PICK'EM</h1>
          <p className="text-xs text-slate-400">Player: <span className="text-white font-bold">{user.name}</span></p>
        </div>
        <span className={`text-[11px] px-3 py-1 rounded-full font-bold ${
          isLocked ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        }`}>
          {isLocked ? 'PICKS LOCKED' : 'OPEN (DUE WED 11:59PM)'}
        </span>
      </header>

      {/* Leaderboard Card */}
      <section className="p-4 mx-3 my-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
        <h2 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-3">Head-to-Head Standings</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center">
            <span className="text-xs text-slate-400 font-semibold block">Ryan</span>
            <span className="text-2xl font-black text-white">0 <span className="text-xs font-normal text-slate-500">pts</span></span>
          </div>
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center">
            <span className="text-xs text-slate-400 font-semibold block">Angi</span>
            <span className="text-2xl font-black text-white">0 <span className="text-xs font-normal text-slate-500">pts</span></span>
          </div>
        </div>
      </section>

      {/* Matchups Slate */}
      <main className="px-3 space-y-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Weekly Slate (4 Random + MNF)</span>
          <span className="text-xs font-bold text-emerald-400">{Object.keys(picks).length}/5 Selected</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <p className="text-sm font-semibold text-slate-300">Live Weekly Slate Syncs Every Tuesday</p>
          <p className="text-xs text-slate-500 mt-1">4 random matchups plus Monday Night Football will appear here each week automatically.</p>
        </div>

        <button
          onClick={submitPicks}
          disabled={isLocked || Object.keys(picks).length < 5 || loading}
          className="w-full py-4 rounded-2xl font-black text-sm bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 shadow-lg transition active:scale-98"
        >
          {loading ? 'SUBMITTING...' : isLocked ? 'PICKS CLOSED FOR THIS WEEK' : 'LOCK IN PICKS'}
        </button>
      </main>
    </div>
  );
}