import { NextResponse } from 'next/server';
import { readData } from '@/lib/db';

export async function GET() {
  const currentSlate = await readData('current_slate.json');
  const standings = await readData('standings.json');
  const picks = await readData('picks.json');

  return NextResponse.json({
    slate: currentSlate?.games || [],
    week: currentSlate?.week || 1,
    standings: standings || [],
    picks: picks || {}
  });
}