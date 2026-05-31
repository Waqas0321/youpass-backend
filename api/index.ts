import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../dist/app.js';
import { connectDatabase } from '../dist/config/database.js';

const app = createApp();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await connectDatabase();
  } catch (err) {
    console.error('Database connection failed:', err);
    res.status(503).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database connection failed' },
    });
    return;
  }

  return app(req, res);
}
