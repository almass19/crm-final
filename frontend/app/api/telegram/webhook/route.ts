import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { routeUpdate } from '@/lib/telegram-bot/router';
import { readTelegramUpdate } from '@/lib/telegram-bot/webhook';

// Webhook of the creative bot (@resultingagency_bot).
export async function POST(request: NextRequest) {
  const update = await readTelegramUpdate(request);
  if (update instanceof NextResponse) return update;

  try {
    await routeUpdate(createAdminClient(), update);
  } catch (e) {
    // Telegram retries on a non-2xx response, and a bug in one handler
    // shouldn't turn into a retry storm — log and still acknowledge.
    console.error('Telegram webhook handler error:', e);
  }

  return NextResponse.json({ ok: true });
}
