import { NextResponse } from 'next/server';
import { fetchCurrentNFLWeek, generateWeeklySlate } from '@/lib/nfl';
import { writeData } from '@/lib/db';

export async function GET() {
  try {
    const espnData = await fetchCurrentNFLWeek();
    const newSlate = generateWeeklySlate(espnData);
    
    writeData('current_slate.json', {
      week: espnData.week?.number || 1,
      createdAt: new Date().toISOString(),
      games: newSlate
    });

    return NextResponse.json({ success: true, count: newSlate.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}