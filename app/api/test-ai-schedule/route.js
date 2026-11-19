import { NextResponse } from 'next/server';
import { readData } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SANDBOX_REDIS_KEY = 'sandbox_ai_schedule.json';

// Default parsed output matching the exact Pydantic NFLSchedule schema from ai_parser.py
const DEFAULT_WEEK_6_SCHEDULE = {
  week: 6,
  games: [
    {
      away_team: 'Washington',
      home_team: 'SF',
      kickoff_time_est: '8:15 PM',
      is_thursday_night: true,
    },
    {
      away_team: 'Jets',
      home_team: 'New England',
      kickoff_time_est: '1:00 PM',
      is_thursday_night: false,
    },
    {
      away_team: 'Seattle',
      home_team: 'Denver',
      kickoff_time_est: '4:05 PM',
      is_thursday_night: false,
    },
    {
      away_team: 'Arizona',
      home_team: 'LA Rams',
      kickoff_time_est: '4:25 PM',
      is_thursday_night: false,
    },
    {
      away_team: 'Dallas',
      home_team: 'Green Bay',
      kickoff_time_est: '8:20 PM',
      is_thursday_night: false,
    },
  ],
};

const DEFAULT_PROMPT_TEXT =
  "Alright, looking ahead to week 6, we've got Seattle heading to Denver for a 4:05 PM game on Sunday. Then the Jets play New England at 1 PM. Arizona is at LA Rams later at 4:25. Don't forget Dallas goes to Green Bay for the Sunday night game at 8:20 PM, and Washington visits SF on Thursday night at 8:15.";

export async function GET() {
  try {
    const syncedRecord = await readData(SANDBOX_REDIS_KEY);
    if (syncedRecord && syncedRecord.schedule) {
      return NextResponse.json({
        source: 'redis_sandbox_cron',
        syncedAt: syncedRecord.syncedAt || null,
        rawInput: syncedRecord.rawInput || DEFAULT_PROMPT_TEXT,
        schedule: syncedRecord.schedule,
      });
    }
  } catch (err) {
    console.warn('Could not read sandbox_ai_schedule.json from Redis, using default fixture:', err);
  }

  return NextResponse.json({
    source: 'schema_fixture',
    rawInput: DEFAULT_PROMPT_TEXT,
    schedule: DEFAULT_WEEK_6_SCHEDULE,
  });
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing CRON_SECRET' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const textInput = (body?.text || DEFAULT_PROMPT_TEXT).trim();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        source: 'schema_fixture_fallback',
        warning: 'GEMINI_API_KEY not found in environment; returning default Week 6 parsed fixture.',
        rawInput: textInput,
        schedule: DEFAULT_WEEK_6_SCHEDULE,
      });
    }

    // Call Gemini REST endpoint enforcing the exact NFLSchedule JSON schema from ai_parser.py
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-4-hydrogen:generateContent?key=${apiKey}`;
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: 'You are an automated NFL Data Architect backend service. Your sole purpose is to extract NFL game schedules.',
            },
          ],
        },
        contents: [
          {
            parts: [{ text: textInput }],
          },
        ],
        generationConfig: {
          temperature: 0.0,
          responseMimeType: 'application/json',
          responseSchema: {
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
          },
        },
      }),
    });

    if (!res.ok) {
      return NextResponse.json({
        source: 'schema_fixture_fallback',
        warning: `Gemini API returned ${res.status}; falling back to default Week 6 parsed fixture.`,
        rawInput: textInput,
        schedule: DEFAULT_WEEK_6_SCHEDULE,
      });
    }

    const geminiData = await res.json();
    const rawJsonText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsedSchedule = rawJsonText ? JSON.parse(rawJsonText) : DEFAULT_WEEK_6_SCHEDULE;

    return NextResponse.json({
      source: 'gemini_live',
      rawInput: textInput,
      schedule: parsedSchedule,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err.message || 'Failed to parse schedule',
        schedule: DEFAULT_WEEK_6_SCHEDULE,
      },
      { status: 500 }
    );
  }
}
