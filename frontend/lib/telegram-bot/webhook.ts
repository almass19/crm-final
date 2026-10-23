import { NextRequest, NextResponse } from 'next/server';
import type { TelegramUpdate } from './types';

// Shared by both bots' webhook routes: checks Telegram's secret header and
// parses the update. Returns a response to send back when the request
// shouldn't be processed.
export async function readTelegramUpdate(request: NextRequest): Promise<TelegramUpdate | NextResponse> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    console.error('TELEGRAM_WEBHOOK_SECRET is not configured; refusing webhook request');
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
  if (headerSecret !== secret) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  try {
    return (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }
}
