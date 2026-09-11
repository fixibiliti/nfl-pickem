import { NextResponse } from 'next/server';
import { readData } from '@/lib/db';

export async function POST(req) {
  const { name, pin } = await req.json();
  const users = readData('users.json') || [];

  const user = users.find(
    u => u.name.toLowerCase() === name.trim().toLowerCase() && u.pin === pin.trim()
  );

  if (!user) {
    return NextResponse.json({ error: 'Invalid name or PIN' }, { status: 401 });
  }

  return NextResponse.json({ user: { id: user.id, name: user.name } });
}