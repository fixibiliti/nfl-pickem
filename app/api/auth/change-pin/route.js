import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';
import defaultUsers from '@/data/users.json';

export async function POST(request) {
  try {
    const { userId, newPin } = await request.json();

    if (!newPin || !/^\d{4}$/.test(newPin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
    }

    let users = (await readData('users.json')) || defaultUsers;

    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}