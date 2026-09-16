import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';
import defaultUsers from '@/data/users.json';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId, currentPin, newPin } = await request.json();

    // 1. Validate format of new PIN
    if (!newPin || !/^\d{4}$/.test(newPin)) {
      return NextResponse.json({ error: 'New PIN must be exactly 4 digits.' }, { status: 400 });
    }

    let users = (await readData('users.json')) || defaultUsers;

    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const currentUser = users[userIndex];

    // 2. If this is a normal voluntary PIN change (not a mandatory first-time setup),
    // verify their current PIN matches what is in the database.
    if (!currentUser.mustChangePin) {
      if (!currentPin) {
        return NextResponse.json({ error: 'Current PIN is required.' }, { status: 400 });
      }
      if (String(currentUser.pin).trim() !== String(currentPin).trim()) {
        return NextResponse.json({ error: 'Current PIN is incorrect.' }, { status: 401 });
      }
    }

    // 3. Update the user record
    users[userIndex].pin = newPin.trim();
    users[userIndex].mustChangePin = false;

    await writeData('users.json', users);

    return NextResponse.json({
      success: true,
      user: {
        id: users[userIndex].id,
        name: users[userIndex].name,
        mustChangePin: false
      }
    });
  } catch (err) {
    console.error('Change PIN failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}