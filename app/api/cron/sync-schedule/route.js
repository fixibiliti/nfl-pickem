import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Strict NFLSchedule JSON Schema matching ai_parser.py
const NFL_SCHEDULE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    week: { type: 'INTEGER' },
    games: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          away_team: { type: 'STRING' },
          home_team: { type: 'STRING' },
          kickoff_time_est: { type: 'STRING' },
          is_thursday_night: { type: 'BOOLEAN' },
        },
        required: [
          'away_team',
          'home_team',
          'kickoff_time_est',
          'is_thursday_night',
        ],
      },
    },
  },
  required: ['week', 'games'],
};

// Dedicated sandbox key in Upstash Redis — never read by live Pick'em routes
const SANDBOX_REDIS_KEY = 'sandbox_ai_schedule.json';

export async function GET(request) {
  try {
    // 1. Protect route with CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing CRON_SECRET' },
        { status: 401 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing GEMINI_API_KEY environment variable' },
        { status: 500 }
      );
    }

    // 2. Build raw schedule text to feed into Gemini (read-only peek at current week)
    const { searchParams } = new URL(request.url);
    const currentSlate = await readData('current_slate.json');
    const targetWeek = Number(searchParams.get('week')) || (currentSlate?.week || 1);

    let rawScheduleText = '';
    try {
      const espnRes = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=${targetWeek}`,
        { cache: 'no-store' }
      );
      if (espnRes.ok) {
        const espnData = await espnRes.json();
        const extractTeamRecord = (competitor) => {
          if (!competitor?.records || !Array.isArray(competitor.records)) return '0-0';
          const totalRecord =
            competitor.records.find((r) => r.type === 'total') || competitor.records[0];
          return totalRecord?.summary || '0-0';
        };

        const lines = (espnData.events || []).map((ev) => {
          const comp = ev.competitions?.[0];
          const awayComp = comp?.competitors?.find((c) => c.homeAway === 'away');
          const homeComp = comp?.competitors?.find((c) => c.homeAway === 'home');

          const gameDate = new Date(ev.date);
          const weekday = gameDate.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            weekday: 'long',
          });
          const timeEst = gameDate.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: '2-digit',
          });

          if (awayComp && homeComp) {
            const awayName = awayComp.team?.displayName || awayComp.team?.name || 'Away';
            const homeName = homeComp.team?.displayName || homeComp.team?.name || 'Home';
            const awayRecord = extractTeamRecord(awayComp);
            const homeRecord = extractTeamRecord(homeComp);
            return `${awayName} (${awayRecord}) at ${homeName} (${homeRecord}) — ${weekday} ${timeEst} EST`;
          }

          return `${ev.name} — ${weekday} ${timeEst} EST`;
        });
        if (lines.length > 0) {
          rawScheduleText = `NFL Week ${targetWeek} full schedule:\n` + lines.join('\n');
        }
      }
    } catch (fetchErr) {
      console.warn('ESPN fetch fallback in sync-schedule:', fetchErr);
    }

    // Fallback unstructured text if ESPN has no events for that week
    if (!rawScheduleText) {
      rawScheduleText =
        "Alright, looking ahead to week 6, we've got Seattle heading to Denver for a 4:05 PM game on Sunday. Then the Jets play New England at 1 PM. Arizona is at LA Rams later at 4:25. Don't forget Dallas goes to Green Bay for the Sunday night game at 8:20 PM, and Washington visits SF on Thursday night at 8:15.";
    }

    // 3. Call Gemini (gemini-4-hydrogen) enforcing the strict NFLSchedule JSON schema
    // Retry up to 3 attempts (with a 2-second delay) on 503 or 429 transient errors
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-4-hydrogen:generateContent?key=${apiKey}`;
    const requestPayload = JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: [
              'You are an automated NFL Data Architect and 5-Game Pick\'em Slate Selector backend service.',
              'From the full weekly NFL schedule provided, you MUST select and output EXACTLY 5 games for the weekly Pick\'em slate using these rules:',
              '1. Mandatory Primetime Bookends: Always lock in the Thursday Night Football (TNF) game and the Monday Night Football (MNF) game (if present).',
              '2. Single Flex Pool (Top 3 Matchups): Treat all remaining games (Sunday, Friday, Saturday, or extra holiday games) as a single flex pool and pick the top 3 matchups (or enough to reach exactly 5 total games) based on the highest combined team winning percentage (calculated from the provided win-loss records) and marquee matchup value.',
              '3. Output strictly in the NFLSchedule JSON schema with away_team, home_team, kickoff_time_est, and is_thursday_night (true only for Thursday games).',
            ].join(' '),
          },
        ],
      },
      contents: [
        {
          parts: [{ text: rawScheduleText }],
        },
      ],
      generationConfig: {
        temperature: 0.0,
        responseMimeType: 'application/json',
        responseSchema: NFL_SCHEDULE_SCHEMA,
      },
    });

    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 2000;
    let geminiRes = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestPayload,
      });

      if (geminiRes.ok) {
        break;
      }

      const isTransient = geminiRes.status === 503 || geminiRes.status === 429;
      if (!isTransient || attempt === MAX_ATTEMPTS) {
        break;
      }

      console.warn(
        `Gemini API returned ${geminiRes.status} (attempt ${attempt}/${MAX_ATTEMPTS}). Retrying in ${RETRY_DELAY_MS}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return NextResponse.json(
        { error: `Gemini API failed with status ${geminiRes.status}`, details: errText },
        { status: 502 }
      );
    }

    const geminiData = await geminiRes.json();
    const rawJsonText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJsonText) {
      return NextResponse.json(
        { error: 'Gemini returned an empty response payload' },
        { status: 502 }
      );
    }

    const parsedSchedule = JSON.parse(rawJsonText);

    // 4. Write ONLY to the isolated sandbox key in Upstash Redis
    const sandboxRecord = {
      syncedAt: new Date().toISOString(),
      sandboxKey: SANDBOX_REDIS_KEY,
      rawInput: rawScheduleText,
      schedule: parsedSchedule,
    };

    await writeData(SANDBOX_REDIS_KEY, sandboxRecord);

    return NextResponse.json({
      success: true,
      storageKey: SANDBOX_REDIS_KEY,
      syncedAt: sandboxRecord.syncedAt,
      schedule: parsedSchedule,
    });
  } catch (err) {
    console.error('Sandbox sync-schedule cron failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
