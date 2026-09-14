import { NextResponse } from 'next/server';
import { readData } from '@/lib/db';

export async function GET() {
  try {
    const slateData = (await readData('current_slate.json')) || { week: 1, games: [] };
    const standings = (await readData('standings.json')) || [];
    const picks = (await readData('picks.json')) || {};

    return NextResponse.json({
      week: slateData.week || 1,
      slate: slateData.games || [],
      standings,
      picks
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}