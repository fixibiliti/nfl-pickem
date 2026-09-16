import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';

export const dynamic = 'force-dynamic';

function checkIsAdmin(requester) {
  return (
    requester &&
    (requester.isAdmin === true ||
      requester.id === 'user_1' ||
      (requester.name && requester.name.toLowerCase() === 'ryan'))
  );
}

export async function POST(request) {
  try {
    const { requesterId, action } = await request.json();

    const users = (await readData('users.json')) || [];
    const requester = users.find((u) => u.id === requesterId);

    if (!checkIsAdmin(requester)) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    if (action === 'sync_scores') {
      const res = await fetch(`${baseUrl}/api/cron/update-scores`);
      const data = await res.json();
      return NextResponse.json({ success: true, message: 'Scores synced with ESPN successfully.' });
    }

    if (action === 'advance_week') {
      const res = await fetch(`${baseUrl}/api/cron/new-week`);
      const data = await res.json();
      return NextResponse.json({ success: true, message: 'Advanced to next week successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err) {
    console.error('Admin action execution failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}