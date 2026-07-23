import { NextRequest, NextResponse } from 'next/server';

/**
 * Verifies the Vercel Cron bearer token. Fails closed: if CRON_SECRET is not
 * configured, the endpoint is rejected rather than left open, since these
 * routes send Telegram notifications and write to the database unauthenticated.
 */
export function checkCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET is not configured; refusing cron request');
    return NextResponse.json({ message: 'Server misconfigured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
