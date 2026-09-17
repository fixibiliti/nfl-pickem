'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');

  // Self-Serve Auth States
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [leaguePasscode, setLeaguePasscode] = useState('');

  // PIN Change State
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Picks and Views
  const [allPicks, setAllPicks] = useState({});
  const [viewingUserId, setViewingUserId] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const [slate, setSlate] = useState([]);
  const [standings, setStandings] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [fullSchedule, setFullSchedule] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Admin State
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');

  // Change PIN State
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState('');
  const [changePinLoading, setChangePinLoading] = useState(false);

  // Tabs: 'slate' | 'leaderboard' | 'history' | 'schedule' | 'admin'
  const [activeTab, setActiveTab] = useState('slate');
  const [week, setWeek] = useState(2);
  const [isScheduleLocked, setIsScheduleLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Dynamic Earliest-Kickoff Countdown & Global Schedule Lockout
  useEffect(() => {
    if (!slate || slate.length === 0) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const kickoffTimestamps = slate
        .map((g) => new Date(g.date).getTime())
        .filter((t) => !isNaN(t));

      if (kickoffTimestamps.length === 0) return;

      const earliestKickoff = Math.min(...kickoffTimestamps);
      const diff = earliestKickoff - now;

      if (diff <= 0) {
        setIsScheduleLocked(true);
        setTimeLeft('Picks Closed');
      } else {
        setIsScheduleLocked(false);
        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (days > 0) {
          setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        } else {
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [slate]);

  // 2. Persistent Login Check with Server Verification
useEffect(() => {
try {
  const savedUser = localStorage.getItem('nfl_pickem_user');
  if (savedUser) {
    const parsed = JSON.parse(savedUser);
    if (parsed?.id) {
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
  const res = await fetch(`/api/slate?userId=${currentUserId || ''}`, {
  cache: 'no-store'
});
  const data = await res.json();

  const userStandings = data.standings || [];

  // Check if user was deleted on the server
  const userStillExists = userStandings.some((s) => s.id === currentUserId);
  if (currentUserId && !userStillExists && currentUserId !== 'user_1') {
    // User was deleted by admin -> force logout
    handleLogout();
    return;
  }

  setSlate(data.slate || []);
  setStandings(userStandings);
  setWeek(data.week || 2);

  const formattedAllPicks = {};
   if (data.picks) {
     Object.entries(data.picks).forEach(([uid, userPickList]) => {
       formattedAllPicks[uid] = {};
       if (Array.isArray(userPickList)) {
         userPickList.forEach((p) => {
           if (p.gameId) {
             formattedAllPicks[uid][p.gameId] = p.selectedTeamId;
           }
         });
       }
     });
   }
  setAllPicks(formattedAllPicks);
  setViewingUserId(currentUserId);

  const mySavedPicks = formattedAllPicks[currentUserId] || {};
  if (Object.keys(mySavedPicks).length === 5) {
    setHasSubmitted(true);
  }
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

// 3. Re-fetch slate, picks, and standings whenever switching tabs
  useEffect(() => {
    if (user?.id) {
      loadSlateAndScores(user.id);
    }
  }, [activeTab, user?.id]);

  const loadFullSchedule = async (targetWeek) => {
    if (fullSchedule.length > 0) return;
    setLoadingSchedule(true);
    try {
      const res = await fetch(`/api/schedule?week=${targetWeek || week}`);
      const data = await res.json();
      setFullSchedule(data.schedule || []);
    } catch (err) {
      console.error('Failed to load full schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const loadAdminData = async () => {
  if (!user?.isAdmin) return;
  setAdminLoading(true);
  try {
    const [usersRes, settingsRes] = await Promise.all([
      fetch(`/api/admin/users?requesterId=${user.id}`),
      fetch(`/api/admin/settings?requesterId=${user.id}`)
    ]);
    const usersData = await usersRes.json();
    const settingsData = await settingsRes.json();

    if (usersRes.ok) setAdminUsers(usersData.users || []);
    if (settingsRes.ok && settingsData.leaguePasscode) {
      setAdminPasscode(settingsData.leaguePasscode);
      setNewPasscode(settingsData.leaguePasscode);
    }
  } catch (err) {
    console.error('Failed to load admin data:', err);
  } finally {
    setAdminLoading(false);
  }
};

  const handleAdminAction = async (action, targetUserId) => {
    setAdminMessage('');
    if (action === 'delete_user' && !confirm('Are you sure you want to completely delete this user and their picks?')) {
      return;
    }

    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: user.id,
          action,
          targetUserId
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAdminMessage(data.message || 'Action completed successfully.');
        loadAdminUsers();
        loadSlateAndScores(user.id);
      } else {
        alert(data.error || 'Admin action failed.');
      }
    } catch (err) {
      console.error('Admin action request failed:', err);
    } finally {
      setAdminLoading(false);
    }
  };

    const handleUpdatePasscode = async (e) => {
      e.preventDefault();
      setAdminMessage('');
      setAdminLoading(true);
      try {
        const res = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requesterId: user.id,
            passcode: newPasscode
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAdminPasscode(data.leaguePasscode);
        setAdminMessage(data.message);
      } else {
        alert(data.error || 'Failed to update passcode.');
      }
    } catch (err) {
    console.error('Error updating passcode:', err);
    } finally {
      setAdminLoading(false);
    }
  };

  // Unified Handler for Login & Sign Up
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (authMode === 'login') {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin })
      });
      const data = await res.json();
      setLoading(false);

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
    } else {
      // Sign Up (Registration)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin, passcode: leaguePasscode })
      });
      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setUser(data.user);
        localStorage.setItem('nfl_pickem_user', JSON.stringify(data.user));
        loadSlateAndScores(data.user.id);
        loadHistory();
      } else {
        setError(data.error || 'Registration failed.');
      }
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('nfl_pickem_user');
    } catch (e) {
      console.error('Logout error:', e);
    }
    setUser(null);
    setName('');
    setPin('');
    setLeaguePasscode('');
    setError('');
    setHasSubmitted(false);
    setActiveTab('slate');
  };

  const handleChangePinSubmit = async (e) => {
    e.preventDefault();
    setChangePinError('');
    setChangePinSuccess('');

    if (newPinInput.length !== 4 || !/^\d{4}$/.test(newPinInput)) {
      setChangePinError('New PIN must be exactly 4 digits.');
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setChangePinError('New PINs do not match.');
      return;
    }

    setChangePinLoading(true);
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentPin: currentPinInput,
          newPin: newPinInput
        })
      });

      const data = await res.json();
      if (res.ok) {
        setChangePinSuccess('PIN updated successfully!');
        setTimeout(() => {
          setShowChangePinModal(false);
          setCurrentPinInput('');
          setNewPinInput('');
          setConfirmPinInput('');
          setChangePinSuccess('');
        }, 1200);
      } else {
        setChangePinError(data.error || 'Failed to update PIN.');
      }
    } catch (err) {
      setChangePinError('Network error. Try again.');
    } finally {
      setChangePinLoading(false);
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
    if (isScheduleLocked || hasSubmitted || viewingUserId !== user?.id) return;

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
      setHasSubmitted(true);
    } else {
      alert('Failed to lock in picks. Please try again.');
    }
  };

  const viewingPlayerName = standings.find((s) => s.id === viewingUserId)?.name || user?.name;
  const currentDisplayedPicks = allPicks[viewingUserId] || {};
  const sortedStandings = [...standings].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

  // SCREEN A: FIRST-TIME PIN CREATION
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
                placeholder=""
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
                placeholder=""
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

  // SCREEN B: DYNAMIC AUTH (LOGIN & SELF-SERVE SIGN UP)
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <div className="text-center mb-5">
            <span className="text-4xl">🏈</span>
            <h1 className="text-2xl font-black text-emerald-400 tracking-tight mt-1">NFL 5-PICK'EM</h1>
            <p className="text-xs text-slate-400 mt-0.5">2026 Weekly Pick'em Challenge</p>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 mb-5">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setError('');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                authMode === 'login'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setError('');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                authMode === 'signup'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Join League (Sign Up)
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                {authMode === 'login' ? 'Your Name' : 'Choose Your Display Name'}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={authMode === 'login' ? 'e.g. Ryan' : 'e.g. Dave B'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                {authMode === 'login' ? '4-Digit PIN' : 'Create a 4-Digit PIN'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white tracking-widest text-center text-base focus:outline-none focus:border-emerald-500"
              />
            </div>

            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  League Passcode
                </label>
                <input
                  type="text"
                  required
                  value={leaguePasscode}
                  onChange={(e) => setLeaguePasscode(e.target.value)}
                  placeholder="Ask Commissioner for Code"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-center uppercase text-sm tracking-wider focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500 block text-center mt-1">
                  Prevents unauthorized sign-ups
                </span>
              </div>
            )}

            {error && <p className="text-xs text-rose-400 text-center font-semibold">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black py-3 rounded-xl transition shadow-lg text-xs uppercase tracking-wider active:scale-95 mt-2"
            >
              {loading
                ? 'VERIFYING...'
                : authMode === 'login'
                ? 'ENTER DASHBOARD'
                : 'CREATE ACCOUNT & JOIN'}
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
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 shadow-md">
       {/* Top Header Row: 3-column layout */}
        <div className="flex justify-between items-start pt-1 pb-2">
          {/* Left Column: Player Info & Actions */}
          <div className="flex flex-col items-start gap-1">
            <div className="text-xs text-slate-400">
              Player: <span className="font-bold text-white">{user?.name}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <button
                type="button"
                onClick={handleLogout}
                className="text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded transition active:scale-95"
              >
                LOG OUT
              </button>
              <button
                type="button"
                onClick={() => {
                  setChangePinError('');
                  setChangePinSuccess('');
                  setCurrentPinInput('');
                  setNewPinInput('');
                  setConfirmPinInput('');
                  setShowChangePinModal(true);
                }}
                className="text-[10px] font-bold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 px-2 py-0.5 rounded transition active:scale-95"
              >
                CHANGE PIN
              </button>
            </div>
          </div>

          {/* Center Column: App Title */}
          <div className="text-center">
            <h1 className="text-base sm:text-lg font-black tracking-wider text-emerald-400 uppercase">
              NFL 5-PICK'EM
            </h1>
          </div>

          {/* Right Column: Picks Open Badge & Countdown */}
          <div className="flex flex-col items-end gap-1">
            <span
              className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border ${
                isScheduleLocked
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              }`}
            >
              {isScheduleLocked ? 'PICKS LOCKED' : 'PICKS OPEN'}
            </span>
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <span>⏳</span>
              <span>{timeLeft}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs (With Conditional Admin Tab) */}
      <div className="flex bg-slate-900 border-b border-slate-800 px-2 pt-2">
        <button
          onClick={() => {
            setActiveTab('slate'); //or 'picks', whichever it uses
            if (user?.id) loadSlateAndSCores(user.id);
          }}
          className={`flex-1 py-2.5 text-xs font-bold transition border-b-2 text-center ${
            activeTab === 'slate'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Picks
        </button>
        <button
          onClick={() => {
            setActiveTab('leaderboard');
            if (user?.id) loadSlateAndScores(user.id);
          }}
            className={`flex-1 py-2.5 text-xs font-bold transition border-b-2 text-center ${
            activeTab === 'leaderboard'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Leaderboard 🏆
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
          Recap 📜
        </button>
        <button
          onClick={() => {
            setActiveTab('schedule');
            loadFullSchedule(week);
          }}
          className={`flex-1 py-2.5 text-xs font-bold transition border-b-2 text-center ${
            activeTab === 'schedule'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Schedule 🗓️
        </button>
        {user?.isAdmin && (
          <button
            onClick={() => {
              setActiveTab('admin');
              loadAdminData();
            }}
            className={`flex-1 py-2.5 text-xs font-bold transition border-b-2 text-center ${
              activeTab === 'admin'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-amber-400/60 hover:text-amber-300'
            }`}
          >
            Admin ⚙️
          </button>
        )}
      </div>

      {/* TAB 1: WEEKLY PICKS SLATE */}
      {activeTab === 'slate' && (
        <main className="px-3 py-3 space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Week {week} Slate • <span className="text-emerald-400">{viewingPlayerName}'s Picks</span>
            </span>
            <span className="text-xs font-bold text-emerald-400">
              {Object.keys(currentDisplayedPicks).length}/5 Selected
            </span>
          </div>

          {viewingUserId !== user.id && (
            <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl text-xs text-slate-400 flex items-center justify-between px-3">
              <span>
                Viewing <strong>{viewingPlayerName}</strong>'s picks
              </span>
              <div className="flex items-center gap-2">
                {!isScheduleLocked && (
                <span className="text-rose-400 font-semibold text-[10px] bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">
                     🔒 Hidden Until Kickoff
                </span>
                )}
                <button
                  type="button"
                  onClick={() => setViewingUserId(user.id)}
                  className="text-emerald-400 font-bold hover:underline text-[11px]"
                >
                  Back to Mine
                </button>
              </div>
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

              const canEditThisSlate = !isScheduleLocked && !hasSubmitted && viewingUserId === user.id && !game.isCompleted;

              const isAwayWinner = game.isCompleted && game.winnerId === game.awayTeam.id;
              const isHomeWinner = game.isCompleted && game.winnerId === game.homeTeam.id;

              return (
                <div key={game.gameId} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
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

                  <div className="grid grid-cols-2 gap-3">
                    {/* AWAY TEAM */}
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

                    {/* HOME TEAM */}
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
            <div className="pt-2 space-y-2">
              {hasSubmitted && !isScheduleLocked ? (
                <div className="space-y-2">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-center text-xs font-bold">
                    ✓ Your picks are locked in! Good luck this week!
                  </div>
                  <button
                    type="button"
                    onClick={() => setHasSubmitted(false)}
                    className="w-full py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition active:scale-98"
                  >
                    Change / Edit My Picks
                  </button>
                </div>
              ) : (
                <button
                  onClick={submitPicks}
                  disabled={isScheduleLocked || Object.keys(currentDisplayedPicks).length < 5 || loading}
                  className="w-full py-4 rounded-xl font-black text-sm bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 shadow-lg transition active:scale-98"
                >
                  {loading
                    ? 'SAVING PICKS...'
                    : isScheduleLocked
                    ? 'PICKS CLOSED FOR THIS WEEK'
                    : 'LOCK IN PICKS'}
                </button>
              )}
            </div>
          )}
        </main>
      )}

      {/* TAB 2: VERTICAL LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <main className="px-3 py-3 space-y-3">
          <div className="flex justify-between items-center px-1 mb-1">
            <div>
              <h2 className="text-sm font-black text-white tracking-wide">SEASON LEADERBOARD</h2>
              <p className="text-[11px] text-slate-400">Tap any player to view their week's picks</p>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              {standings.length} Players
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-800/80">
            <div className="grid grid-cols-12 px-4 py-2.5 bg-slate-950/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className="col-span-2">Rank</span>
              <span className="col-span-5">Player</span>
              <span className="col-span-2 text-center">Score</span>
              <span className="col-span-3 text-right">Status</span>
            </div>

            {sortedStandings.map((player, index) => {
              const isCurrentUser = player.id === user.id;
              const isViewingThisPlayer = player.id === viewingUserId;
              const playerPicksCount = allPicks[player.id] ? Object.keys(allPicks[player.id]).length : 0;
              const isPlayerSubmitted = playerPicksCount === 5;

              const rank = index + 1;
              const rankBadgeColor =
                rank === 1
                  ? 'text-amber-400 font-black'
                  : rank === 2
                  ? 'text-slate-300 font-bold'
                  : rank === 3
                  ? 'text-amber-600 font-bold'
                  : 'text-slate-500 font-semibold';

              return (
                <button
                  type="button"
                  key={player.id}
                  onClick={() => {
                    setViewingUserId(player.id);
                    setActiveTab('slate');
                  }}
                  className={`w-full grid grid-cols-12 items-center px-4 py-3.5 text-left transition-colors cursor-pointer active:bg-slate-800/70 ${
                    isCurrentUser ? 'bg-emerald-500/10 hover:bg-emerald-500/15' : 'hover:bg-slate-800/40'
                  } ${isViewingThisPlayer && !isCurrentUser ? 'ring-1 ring-inset ring-emerald-400/40' : ''}`}
                >
                  <span className={`col-span-2 text-sm ${rankBadgeColor}`}>
                    #{rank}
                  </span>

                  <div className="col-span-5 flex items-center gap-1.5 truncate">
                    <span className={`text-xs font-bold truncate ${isCurrentUser ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {player.name}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        YOU
                      </span>
                    )}
                  </div>

                  <span className="col-span-2 text-center font-black text-sm text-white">
                    {player.totalScore || 0}
                  </span>

                  <div className="col-span-3 flex justify-end">
                    {isPlayerSubmitted ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5 tracking-tight">
                        <span>🔒</span> Locked
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 flex items-center gap-0.5 tracking-tight">
                        <span>⏳</span> Picking
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </main>
      )}

      {/* TAB 3: SEASON RECAP DASHBOARD */}
      {activeTab === 'history' && (
        <main className="px-3 py-3 space-y-4">
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
                        {standings.map((p) => {
                          const userPick = archive.picks?.[p.id]?.find((pk) => pk.gameId === g.gameId)?.selectedTeamId;
                          const isWinner = g.winnerId && userPick === g.winnerId;
                          const teamAbbrev = userPick === g.homeTeam.id ? g.homeTeam.abbrev : g.awayTeam.abbrev;

                          return (
                            <div key={p.id}>
                              <span className="text-[10px] text-slate-500 block mb-1 truncate">{p.name}</span>
                              {userPick ? (
                                <span
                                  className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                    isWinner
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                      : 'bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  {teamAbbrev} {isWinner ? '✓' : ''}
                                </span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </main>
      )}

      {/* TAB 4: FULL NFL SCHEDULE */}
      {activeTab === 'schedule' && (
        <main className="px-3 py-3 space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Week {week} Full NFL Schedule
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {fullSchedule.length} Games
            </span>
          </div>

          {loadingSchedule ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-sm animate-pulse">
              Loading official NFL schedule...
            </div>
          ) : fullSchedule.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-sm">
              Schedule not found for this week.
            </div>
          ) : (
            <div className="space-y-2.5">
              {fullSchedule.map((game) => {
                const isPickemGame = slate.some((sg) => sg.gameId === game.gameId);

                return (
                  <div
                    key={game.gameId}
                    className={`rounded-xl p-3 border transition-all ${
                      isPickemGame
                        ? 'bg-slate-900/95 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                        : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10px] font-medium text-slate-400 border-b border-slate-800/60 pb-1.5 mb-2">
                      <span className="text-slate-300 font-semibold">
                        {game.dayOfWeek} {new Date(game.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} • {new Date(game.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        {game.broadcast && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[9px]">
                            {game.broadcast}
                          </span>
                        )}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isPickemGame && (
                          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold px-1.5 py-0.5 rounded text-[9px] tracking-wide">
                            ⭐ 5-PICK MATCHUP
                          </span>
                        )}
                        {game.isCompleted ? (
                          <span className="bg-slate-800 text-amber-400 font-bold px-1.5 py-0.5 rounded text-[9px]">
                            FINAL
                          </span>
                        ) : game.isInProgress ? (
                          <span className="bg-rose-500/20 text-rose-400 font-bold px-1.5 py-0.5 rounded text-[9px] animate-pulse">
                            🔴 LIVE
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center text-xs">
                      {/* Away Team */}
                      <div className="flex items-center justify-between bg-slate-950/70 p-2 rounded-lg border border-slate-800/60">
                        <div className="flex items-center gap-2 truncate">
                          {game.awayTeam.logo && (
                            <img
                              src={game.awayTeam.logo}
                              alt={game.awayTeam.name}
                              className="w-5 h-5 object-contain"
                            />
                          )}
                          <span className="font-bold text-slate-200">{game.awayTeam.abbrev}</span>
                        </div>
                        {game.awayScore !== null && (
                          <span className="font-black text-white ml-2 text-sm">{game.awayScore}</span>
                        )}
                      </div>

                      {/* Home Team */}
                      <div className="flex items-center justify-between bg-slate-950/70 p-2 rounded-lg border border-slate-800/60">
                        <div className="flex items-center gap-2 truncate">
                          {game.homeTeam.logo && (
                            <img
                              src={game.homeTeam.logo}
                              alt={game.homeTeam.name}
                              className="w-5 h-5 object-contain"
                            />
                          )}
                          <span className="font-bold text-slate-200">{game.homeTeam.abbrev}</span>
                        </div>
                        {game.homeScore !== null && (
                          <span className="font-black text-white ml-2 text-sm">{game.homeScore}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

     {/* TAB 5: COMMISSIONER ADMIN PANEL */}
      {activeTab === 'admin' && user?.isAdmin && (
        <main className="px-3 py-3 space-y-4">
          <div className="flex justify-between items-center px-1">
            <div>
              <h2 className="text-sm font-black text-amber-400 tracking-wide uppercase">League Administration</h2>
              <p className="text-[11px] text-slate-400">Manage players, registration codes, and game state</p>
            </div>
            <button
              onClick={loadAdminData}
              disabled={adminLoading}
              className="text-xs px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition active:scale-95 flex items-center gap-1"
            >
              <span>{adminLoading ? '⏳' : '⟳'}</span>
              <span>{adminLoading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>

          {adminMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex justify-between items-center">
              <span>✓ {adminMessage}</span>
              <button onClick={() => setAdminMessage('')} className="text-slate-500 hover:text-slate-300">✕</button>
            </div>
          )}

          {/* Registered Players Table */}
          {/* Card 1: League Join Passcode */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              League Join Passcode
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">
              New players must enter this code when registering.
            </p>
            <form onSubmit={handleUpdatePasscode} className="flex gap-2">
              <input
                type="text"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value.toUpperCase())}
                placeholder="PASSCODE"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm uppercase tracking-wider focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={adminLoading || newPasscode === adminPasscode || !newPasscode}
                className="px-4 py-2 rounded-xl font-bold text-xs bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 transition active:scale-95"
              >
                Save
              </button>
            </form>
          </div>

          {/* Card 2: Commissioner Slate & Week Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Commissioner Slate Controls
              </h3>
              <p className="text-[11px] text-slate-400">
                Trigger manual syncs or advance to next week on demand
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  setAdminLoading(true);
                  try {
                    const res = await fetch('/api/admin/actions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ requesterId: user.id, action: 'sync_scores' })
                    });
                    const d = await res.json();
                    setAdminMessage(d.message || 'Scores updated.');
                    loadSlateAndScores(user.id);
                  } catch (e) {
                    alert('Score sync failed.');
                  } finally {
                    setAdminLoading(false);
                  }
                }}
                disabled={adminLoading}
                className="py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 transition active:scale-95 text-center"
              >
                🔄 Force Score Sync
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Advance to next week? This archives current picks to History and fetches the new week slate.')) return;
                  setAdminLoading(true);
                  try {
                    const res = await fetch('/api/admin/actions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ requesterId: user.id, action: 'advance_week' })
                    });
                    const d = await res.json();
                    setAdminMessage(d.message || 'Week advanced.');
                    loadSlateAndScores(user.id);
                  } catch (e) {
                    alert('Failed to advance week.');
                  } finally {
                    setAdminLoading(false);
                  }
                }}
                disabled={adminLoading}
                className="py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400/40 text-xs font-bold text-amber-400 transition active:scale-95 text-center"
              >
                ⏭️ Advance Week
              </button>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-800/80">
            <div className="px-4 py-2.5 bg-slate-950/60 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex justify-between">
              <span>Registered Players ({adminUsers.length})</span>
              <span>Actions</span>
            </div>

            {adminUsers.map((u) => {
              const isCurrentUser = u.id === user.id;

              return (
                <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white truncate">{u.name}</span>
                      {u.isAdmin && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-400 border border-amber-400/30">
                          ADMIN
                        </span>
                      )}
                      {u.mustChangePin && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          PIN PENDING
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                      ID: {u.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAdminAction('reset_pin', u.id)}
                      disabled={adminLoading}
                      className="px-2.5 py-1 text-[10px] font-bold bg-slate-950 hover:bg-slate-800 text-amber-400 border border-amber-400/30 rounded-lg transition active:scale-95"
                    >
                      Reset PIN
                    </button>
                    {!isCurrentUser && (
                      <button
                        type="button"
                        onClick={() => handleAdminAction('delete_user', u.id)}
                        disabled={adminLoading}
                        className="px-2.5 py-1 text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition active:scale-95"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
       </main>
      )}
    {/* CHANGE PIN MODAL */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xs rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Change 4-Digit PIN
              </h3>
              <button
                type="button"
                onClick={() => setShowChangePinModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-1"
              >
                ✕
              </button>
            </div>

            {changePinError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs px-3 py-2 rounded-xl text-center">
                {changePinError}
              </div>
            )}

            {changePinSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3 py-2 rounded-xl text-center">
                ✓ {changePinSuccess}
              </div>
            )}

            <form onSubmit={handleChangePinSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Current PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={currentPinInput}
                  onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder=""
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-center text-white tracking-widest text-lg font-mono focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  New 4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder=""
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-center text-white tracking-widest text-lg font-mono focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder=""
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-center text-white tracking-widest text-lg font-mono focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePinModal(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-400 bg-slate-950 border border-slate-800 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePinLoading || !currentPinInput || !newPinInput || !confirmPinInput}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-600 transition"
                >
                  {changePinLoading ? 'Saving...' : 'Update PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}