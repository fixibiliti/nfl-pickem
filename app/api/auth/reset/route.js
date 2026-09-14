import { NextResponse } from 'next/server';
import { writeData } from '@/lib/db';
import defaultUsers from '@/data/users.json';

export async function GET() {
  try {
    // Overwrite users.json in Upstash Redis with default 0000 PINs
    await writeData('users.json', defaultUsers);

    return NextResponse.json({
      success: true,
      message: 'Users have been reset in Upstash Redis to 0000 with mustChangePin: true',
      users: defaultUsers
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}