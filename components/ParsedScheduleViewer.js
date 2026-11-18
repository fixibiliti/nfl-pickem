'use client';

import { useState } from 'react';

export default function ParsedScheduleViewer({
  initialSchedule,
  initialRawInput = '',
  initialSource = 'schema_fixture',
}) {
  const [schedule, setSchedule] = useState(
    initialSchedule || { week: 6, games: [] }
  );
  const [rawJsonInput, setRawJsonInput] = useState(
    JSON.stringify(initialSchedule || { week: 6, games: [] }, null, 2)
  );
  const [jsonError, setJsonError] = useState(null);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'PRIMETIME_SPECIAL' | 'SUNDAY'

  const games = Array.isArray(schedule?.games) ? schedule.games : [];

  // Determine the game day from kickoff_time_est (with fallback to is_thursday_night and initialRawInput)
  const getGameDayType = (game) => {
    const kickoff = String(game?.kickoff_time_est || '');
    if (game?.is_thursday_night || /\bthu(rsday)?\b/i.test(kickoff)) return 'THURSDAY';
    if (/\bmon(day)?\b/i.test(kickoff)) return 'MONDAY';
    if (/\bfri(day)?\b/i.test(kickoff)) return 'FRIDAY';
    if (/\bsat(urday)?\b/i.test(kickoff)) return 'SATURDAY';
    if (/\bsun(day)?\b/i.test(kickoff)) return 'SUNDAY';

    if (initialRawInput && game?.away_team && game?.home_team) {
      const awayLower = String(game.away_team).toLowerCase();
      const homeLower = String(game.home_team).toLowerCase();
      const matchingLine = initialRawInput
        .split('\n')
        .find(
          (line) =>
            line.toLowerCase().includes(awayLower) &&
            line.toLowerCase().includes(homeLower)
        );
      if (matchingLine) {
        if (/\bthu(rsday)?\b/i.test(matchingLine)) return 'THURSDAY';
        if (/\bmon(day)?\b/i.test(matchingLine)) return 'MONDAY';
        if (/\bfri(day)?\b/i.test(matchingLine)) return 'FRIDAY';
        if (/\bsat(urday)?\b/i.test(matchingLine)) return 'SATURDAY';
      }
    }

    return 'SUNDAY';
  };

  const tnfCount = games.filter((g) => getGameDayType(g) === 'THURSDAY').length;
  const mnfCount = games.filter((g) => getGameDayType(g) === 'MONDAY').length;
  const specialCount = games.filter((g) => {
    const day = getGameDayType(g);
    return day === 'FRIDAY' || day === 'SATURDAY';
  }).length;
  const sundayCount = games.filter((g) => getGameDayType(g) === 'SUNDAY').length;
  const primetimeSpecialCount = games.length - sundayCount;

  const filteredGames = games.filter((game) => {
    const dayType = getGameDayType(game);
    if (filterMode === 'PRIMETIME_SPECIAL') return dayType !== 'SUNDAY';
    if (filterMode === 'SUNDAY') return dayType === 'SUNDAY';
    return true;
  });

  const handleApplyCustomJson = () => {
    try {
      const parsed = JSON.parse(rawJsonInput);
      if (typeof parsed.week !== 'number' || !Array.isArray(parsed.games)) {
        throw new Error(
          'Schema validation failed: expected { "week": number, "games": [...] }'
        );
      }
      setSchedule(parsed);
      setJsonError(null);
    } catch (err) {
      setJsonError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Summary Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                NFL Week {schedule?.week ?? '—'}
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                {games.length} {games.length === 1 ? 'Matchup' : 'Matchups'}
              </span>
              {tnfCount > 0 && (
                <span className="text-xs font-bold text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-md border border-amber-500/30">
                  {tnfCount} TNF Primetime
                </span>
              )}
              {mnfCount > 0 && (
                <span className="text-xs font-bold text-sky-300 bg-sky-500/15 px-2.5 py-1 rounded-md border border-sky-500/30">
                  {mnfCount} MNF Primetime
                </span>
              )}
              {specialCount > 0 && (
                <span className="text-xs font-bold text-purple-300 bg-purple-500/15 px-2.5 py-1 rounded-md border border-purple-500/30">
                  {specialCount} Special
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-2 tracking-tight">
              NFL Schedule Preview
            </h1>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setShowJsonEditor((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              {showJsonEditor ? 'Hide JSON Inspector' : '{ } Inspect / Edit JSON'}
            </button>
          </div>
        </div>

        {/* Source Prompt Preview */}
        {initialRawInput && (
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-wider font-bold mb-1.5">
              <span>Source Text Input (ai_parser.py)</span>
              <span className="font-mono text-[10px] text-slate-500">
                source: {initialSource}
              </span>
            </div>
            <p className="text-xs text-slate-300 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 italic leading-relaxed">
              &ldquo;{initialRawInput}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Collapsible Raw JSON Schema Inspector / Editor */}
      {showJsonEditor && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Pydantic <code className="text-emerald-400">NFLSchedule</code> JSON Payload
            </span>
            <button
              type="button"
              onClick={handleApplyCustomJson}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
            >
              Apply JSON to Cards
            </button>
          </div>
          <textarea
            value={rawJsonInput}
            onChange={(e) => setRawJsonInput(e.target.value)}
            rows={12}
            spellCheck={false}
            className="w-full font-mono text-xs bg-slate-950 text-emerald-300 border border-slate-800 rounded-xl p-3 focus:outline-none focus:border-emerald-500/60"
          />
          {jsonError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {jsonError}
            </p>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-1">
          {[
            { id: 'ALL', label: `All Games (${games.length})` },
            { id: 'PRIMETIME_SPECIAL', label: `Primetime / Special (${primetimeSpecialCount})` },
            { id: 'SUNDAY', label: `Sunday Slate (${sundayCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filterMode === tab.id
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Matchup Cards Grid */}
      {filteredGames.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-400">
          No games match the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGames.map((game, idx) => {
            const dayType = getGameDayType(game);
            const isTNF = dayType === 'THURSDAY';
            const isMNF = dayType === 'MONDAY';
            const isSpecial = dayType === 'FRIDAY' || dayType === 'SATURDAY';

            let cardStyle = 'bg-slate-900 border-slate-800 hover:border-slate-700';
            if (isTNF) {
              cardStyle =
                'bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 border-amber-500/40 shadow-md shadow-amber-500/5';
            } else if (isMNF) {
              cardStyle =
                'bg-gradient-to-br from-sky-950/30 via-slate-900 to-slate-900 border-sky-500/40 shadow-md shadow-sky-500/5';
            } else if (isSpecial) {
              cardStyle =
                'bg-gradient-to-br from-purple-950/30 via-slate-900 to-slate-900 border-purple-500/40 shadow-md shadow-purple-500/5';
            }

            return (
              <div
                key={`${game.away_team}-${game.home_team}-${idx}`}
                className={`relative rounded-2xl p-4 border transition-all ${cardStyle}`}
              >
                {/* Top Card Meta Row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isTNF ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40">
                        ★ Thursday Night Football
                      </span>
                    ) : isMNF ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-sky-400/20 text-sky-300 border border-sky-400/40">
                        ★ Monday Night Football
                      </span>
                    ) : isSpecial ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-purple-400/20 text-purple-300 border border-purple-400/40">
                        ★ {dayType} Special Matchup
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                        Sunday Matchup
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-400 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                    <span>🕒</span>
                    <span>
                      {/\bEST\b/i.test(game.kickoff_time_est || '')
                        ? game.kickoff_time_est
                        : `${game.kickoff_time_est} EST`}
                    </span>
                  </div>
                </div>

                {/* Teams Matchup Box */}
                <div className="grid grid-cols-11 items-center bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
                  {/* Away Team */}
                  <div className="col-span-5 text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Away
                    </span>
                    <span className="text-base sm:text-lg font-extrabold text-white truncate block mt-0.5">
                      {game.away_team}
                    </span>
                  </div>

                  {/* @ Divider */}
                  <div className="col-span-1 flex justify-center">
                    <span className="w-7 h-7 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                      @
                    </span>
                  </div>

                  {/* Home Team */}
                  <div className="col-span-5 text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Home
                    </span>
                    <span className="text-base sm:text-lg font-extrabold text-emerald-400 truncate block mt-0.5">
                      {game.home_team}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
