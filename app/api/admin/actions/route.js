import { NextResponse } from 'next/server';
import { readData } from '@/lib/db';

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

    // Always use the real host/origin from the incoming browser request
    const origin = request.nextUrl ? request.nextUrl.origin : new URL(request.url).origin;

    if (action === 'sync_scores') {
      const res = await fetch(`${origin}/api/cron/update-scores`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ success: true, message: data.message || 'Scores synced with ESPN successfully.' });
    }

    if (action === 'advance_week') {
      const res = await fetch(`${origin}/api/cron/new-week`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return NextResponse.json(
          { error: data.error || `Rollover rejected with status ${res.status}` },
          { status: res.status }
        );
      }

      return NextResponse.json({
        success: true,
        message: data.message || 'Advanced to next week successfully.',
      });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err) {
    console.error('Admin action execution failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}