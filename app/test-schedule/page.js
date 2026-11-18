'use client';

import { useState, useEffect } from 'react';
import ParsedScheduleViewer from '../../components/ParsedScheduleViewer';

export default function TestSchedulePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadParsedSchedule() {
      try {
        const res = await fetch('/api/test-ai-schedule', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load parsed schedule');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadParsedSchedule();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Sandbox Banner */}
        <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider text-[10px] border border-emerald-500/30">
              Sandbox Test Page
            </span>
            <span className="text-slate-400">
              Isolated route (<code className="text-slate-200 font-mono">/test-schedule</code>) — live pages untouched
            </span>
          </div>
          <a
            href="/"
            className="text-slate-400 hover:text-emerald-400 font-semibold transition-colors"
          >
            ← Back to Live App
          </a>
        </div>

        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-400 animate-pulse">
            Loading parsed Week 6 NFL schedule...
          </div>
        )}

        {error && (
          <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-6 text-sm text-rose-300">
            Error loading schedule: {error}
          </div>
        )}

        {!loading && data && (
          <ParsedScheduleViewer
            initialSchedule={data.schedule}
            initialRawInput={data.rawInput}
            initialSource={data.source}
          />
        )}
      </div>
    </main>
  );
}
