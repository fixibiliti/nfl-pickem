import { Redis } from '@upstash/redis';

// Connect automatically using Vercel's injected environment variables
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Fallback initial data
const DEFAULTS = {
  'users.json': [
    { id: 'user_1', name: 'Ryan', pin: '4321' },
    { id: 'user_2', name: 'Angi', pin: '4321' }
    { id: 'user_3', name: 'Mary', pin: '4321' }
  ],
  'standings.json': [
    { id: 'user_1', name: 'Ryan', totalScore: 0 },
    { id: 'user_2', name: 'Angi', totalScore: 0 }
    { id: 'user_3', name: 'Mary', totalScore: 0 }
  ],
  'picks.json': {},
  'current_slate.json': { week: 1, games: [] }
  'history.json'; []
};

export async function readData(key) {
  try {
    const data = await redis.get(key);
    if (data !== null && data !== undefined) {
      return typeof data === 'string' ? JSON.parse(data) : data;
    }
    return DEFAULTS[key] || null;
  } catch (err) {
    console.error(`Error reading ${key} from Redis:`, err);
    return DEFAULTS[key] || null;
  }
}

export async function writeData(key, data) {
  try {
    await redis.set(key, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error(`Error writing ${key} to Redis:`, err);
    throw err;
  }
}