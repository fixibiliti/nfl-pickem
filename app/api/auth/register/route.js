import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { name, pin, passcode } = await request.json();

    // 1. Clean & validate inputs
    const trimmedName = (name || '').trim();
    const cleanPin = (pin || '').trim();
    const cleanPasscode = (passcode || '').trim();

    if (!trimmedName || trimmedName.length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters.' }, { status: 400 });
    }

    if (!/^\d{4}$/.test(cleanPin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits.' }, { status: 400 });
    }

    // 2. Validate League Passcode against the Vercel Config Variable
    const validPasscode = process.env.LEAGUE_PASSCODE || 'GRIDIRON2026';
    if (cleanPasscode.toUpperCase() !== validPasscode.toUpperCase()) {
      return NextResponse.json({ error: 'Invalid League Passcode. Ask the commissioner for the code!' }, { status: 401 });
    }

    // 3. Load existing users and standings
    const users = (await readData('users.json')) || [];
    const standings = (await readData('standings.json')) || [];

    // Check if name is already registered (case-insensitive)
    const existingUser = users.find(u => u.name.toLowerCase() === trimmedName.toLowerCase());
    if (existingUser) {
      return NextResponse.json({ error: `The name "${trimmedName}" is already taken. Please choose another or Log In.` }, { status: 409 });
    }

    // 4. Generate unique User ID
    const newUserId = `user_${Date.now()}`;

    const newUser = {
      id: newUserId,
      name: trimmedName,
      pin: cleanPin,
      mustChangePin: false,
      createdAt: new Date().toISOString()
    };

    // 5. Append to users list and initialize standings with 0 points
    users.push(newUser);
    standings.push({
      id: newUserId,
      name: trimmedName,
      totalScore: 0
    });

    // Save to Upstash Redis
    await writeData('users.json', users);
    await writeData('standings.json', standings);

    // Return authenticated user object (excluding PIN)
    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        mustChangePin: false
      }
    });
  } catch (err) {
    console.error('Registration failed:', err);
    return NextResponse.json({ error: err.message || 'Server error during registration' }, { status: 500 });
  }
}