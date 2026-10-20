import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { routeUpdate } from '@/lib/telegram-bot/router';
import type { TelegramUpdate } from '@/lib/telegram-bot/types';

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    console.error('TELEGRAM_WEBHOOK_SECRET is not configured; refusing webhook request');
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
  if (headerSecret !== secret) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    await routeUpdate(createAdminClient(), update);
  } catch (e) {
    // Telegram retries on a non-2xx response, and a bug in one handler
    // shouldn't turn into a retry storm — log and still acknowledge.
    console.error('Telegram webhook handler error:', e);
  }

  return NextResponse.json({ ok: true });
}
