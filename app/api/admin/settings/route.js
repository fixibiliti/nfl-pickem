import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Helper to confirm admin privileges
function checkIsAdmin(requester) {
  return (
    requester &&
    (requester.isAdmin === true ||
      requester.id === 'user_1' ||
      (requester.name && requester.name.toLowerCase() === 'ryan'))
  );
}

// GET: Retrieve current league settings
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');

    const users = (await readData('users.json')) || [];
    const requester = users.find((u) => u.id === requesterId);

    if (!checkIsAdmin(requester)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const settings = (await readData('settings.json')) || {};
    const activePasscode = settings.leaguePasscode || process.env.LEAGUE_PASSCODE || 'GRIDIRON2026';

    return NextResponse.json({ leaguePasscode: activePasscode });
  } catch (err) {
    console.error('Fetch settings failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Update league passcode
export async function POST(request) {
  try {
    const { requesterId, passcode } = await request.json();

    const users = (await readData('users.json')) || [];
    const requester = users.find((u) => u.id === requesterId);

    if (!checkIsAdmin(requester)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const cleanPasscode = (passcode || '').trim().toUpperCase();
    if (cleanPasscode.length < 3) {
      return NextResponse.json({ error: 'Passcode must be at least 3 characters.' }, { status: 400 });
    }

    const settings = (await readData('settings.json')) || {};
    settings.leaguePasscode = cleanPasscode;
    await writeData('settings.json', settings);

    return NextResponse.json({
      success: true,
      leaguePasscode: cleanPasscode,
      message: `League passcode updated to: ${cleanPasscode}`
    });
  } catch (err) {
    console.error('Update settings failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}