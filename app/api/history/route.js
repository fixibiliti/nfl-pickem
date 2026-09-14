import { NextResponse } from 'next/server';
import { readData } from '@/lib/db';

export async function GET() {
  const history = (await readData('history.json')) || [];
  const users = (await readData('users.json')) || [];
  return NextResponse.json({ history, users });
}