import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';
import defaultUsers from '@/data/users.json';

export async function POST(request) {
  try {
    const { name, pin } = await request.json();
    let users = await readData('users.json');

    // Seed Redis if empty or reset
    if (!users || !Array.isArray(users) || users.length === 0) {
      users = defaultUsers;
      await writeData('users.json', users);
    }

    const foundUser = users.find(
      (u) => u.name.toLowerCase() === name.trim().toLowerCase() && u.pin === pin.trim()
    );

    if (!foundUser) {
      return NextResponse.json({ error: 'Invalid name or temporary PIN' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: foundUser.id,
        name: foundUser.name,
        mustChangePin: Boolean(foundUser.mustChangePin)
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}