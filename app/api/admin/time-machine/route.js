import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { VIRTUAL_CLOCK_COOKIE, generateDynamicPresets } from '@/lib/clock';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week') || '2';

    // 1. Check current virtual clock status from cookie
    const cookieStore = await cookies();
    const rawOverride = cookieStore.get(VIRTUAL_CLOCK_COOKIE)?.value || null;
    const isOverridden = Boolean(rawOverride && !isNaN(Date.parse(rawOverride)));
    const now = new Date();
    const effectiveTime = isOverridden ? new Date(rawOverride).toISOString() : now.toISOString();

    // 2. Fetch the slate to calculate dynamic presets
    const espnRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=${week}`,
      { cache: 'no-store' }
    );

    let presets = [];
    if (espnRes.ok) {
      const data = await espnRes.json();
      const events = data.events || [];
      const kickoffDates = events.map(e => e.date).filter(Boolean);
      presets = generateDynamicPresets(kickoffDates);
    }

    return NextResponse.json({
      actualTime: now.toISOString(),
      virtualTime: isOverridden ? new Date(rawOverride).toISOString() : null,
      effectiveTime,
      isOverridden,
      week: parseInt(week, 10),
      presets,
    });
  } catch (err) {
    console.error('Time machine GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { timestamp, action } = body;
    const cookieStore = await cookies();

    if (action === 'reset' || !timestamp) {
      cookieStore.delete(VIRTUAL_CLOCK_COOKIE);
      return NextResponse.json({
        success: true,
        message: 'Virtual clock reset to actual system time',
        effectiveTime: new Date().toISOString(),
        isOverridden: false,
      });
    }

    const parsed = new Date(timestamp);
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Invalid timestamp format' }, { status: 400 });
    }

    // Set cookie on root path so both admin and app pick logic have access
    cookieStore.set(VIRTUAL_CLOCK_COOKIE, parsed.toISOString(), {
      path: '/',
      httpOnly: false, // Allows UI components to inspect if desired
      sameSite: 'lax',
    });

    return NextResponse.json({
      success: true,
      message: 'Virtual clock updated',
      effectiveTime: parsed.toISOString(),
      isOverridden: true,
    });
  } catch (err) {
    console.error('Time machine POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}