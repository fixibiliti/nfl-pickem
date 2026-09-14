import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';

export async function POST(req) {
  try {
    const { userId, picks } = await req.json();
    const allPicks = (await readData('picks.json')) || {};
    
    allPicks[userId] = Object.entries(picks).map(([gameId, selectedTeamId]) => ({
      gameId,
      selectedTeamId
    }));

    await writeData('picks.json', allPicks);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}