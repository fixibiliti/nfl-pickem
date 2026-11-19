import { NextResponse } from 'next/server';
import { writeData } from '@/lib/db';
import defaultUsers from '@/data/users.json';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing CRON_SECRET' },
        { status: 401 }
      );
    }

    // Overwrite users.json in Upstash Redis with default PINs
    await writeData('users.json', defaultUsers);

    const safeUsers = defaultUsers.map(({ pin, ...rest }) => rest);

    return NextResponse.json({
      success: true,
      message: 'Users have been reset in Upstash Redis with mustChangePin: true',
      users: safeUsers
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}