import { NextResponse } from 'next/server';
import { readData } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { name, pin } = await request.json();
    const trimmedName = (name || '').trim().toLowerCase();
    const cleanPin = (pin || '').trim();

    if (!trimmedName || !cleanPin) {
      return NextResponse.json({ error: 'Name and 4-digit PIN are required.' }, { status: 400 });
    }

    const users = (await readData('users.json')) || [];

    // Case-insensitive name match
    const user = users.find(u => (u.name || '').trim().toLowerCase() === trimmedName);

    if (!user || user.pin !== cleanPin) {
      return NextResponse.json({ error: 'Incorrect Name or 4-Digit PIN.' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        mustChangePin: user.mustChangePin || false,
        isAdmin: user.isAdmin || false
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}