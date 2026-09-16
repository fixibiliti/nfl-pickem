import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: Fetch all users for the Admin panel
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');

    const users = (await readData('users.json')) || [];
    const requester = users.find((u) => u.id === requesterId);

    if (!requester || !requester.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    // Return safe list of users (scrubbing PINs for security)
    const sanitizedUsers = users.map((u) => ({
      id: u.id,
      name: u.name,
      isAdmin: u.isAdmin || false,
      mustChangePin: u.mustChangePin || false,
      createdAt: u.createdAt || null
    }));

    return NextResponse.json({ users: sanitizedUsers });
  } catch (err) {
    console.error('Admin user fetch failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Execute admin actions (reset_pin, delete_user)
export async function POST(request) {
  try {
    const { requesterId, action, targetUserId } = await request.json();

    const users = (await readData('users.json')) || [];
    const requester = users.find((u) => u.id === requesterId);

    if (!requester || !requester.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    if (action === 'reset_pin') {
      const userIndex = users.findIndex((u) => u.id === targetUserId);
      if (userIndex === -1) {
        return NextResponse.json({ error: 'Target user not found.' }, { status: 404 });
      }

      // Reset PIN to temporary 0000 and require change on next login
      users[userIndex].pin = '0000';
      users[userIndex].mustChangePin = true;

      await writeData('users.json', users);
      return NextResponse.json({ success: true, message: `PIN for ${users[userIndex].name} reset to 0000.` });
    }

    if (action === 'delete_user') {
      if (targetUserId === requesterId) {
        return NextResponse.json({ error: 'Cannot delete your own admin account.' }, { status: 400 });
      }

      // 1. Remove from users.json
      const updatedUsers = users.filter((u) => u.id !== targetUserId);
      await writeData('users.json', updatedUsers);

      // 2. Remove from standings.json
      const standings = (await readData('standings.json')) || [];
      const updatedStandings = standings.filter((s) => s.id !== targetUserId);
      await writeData('standings.json', updatedStandings);

      // 3. Remove picks from picks.json
      const picks = (await readData('picks.json')) || {};
      if (picks[targetUserId]) {
        delete picks[targetUserId];
        await writeData('picks.json', picks);
      }

      return NextResponse.json({ success: true, message: 'User cleanly removed from all league records.' });
    }

    return NextResponse.json({ error: 'Invalid admin action.' }, { status: 400 });
  } catch (err) {
    console.error('Admin action failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}