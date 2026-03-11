import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
    if (headerSecret !== secret) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = body.message as Record<string, unknown> | undefined;
  if (!message) return NextResponse.json({ ok: true });

  const text = message.text as string | undefined;
  const chat = message.chat as Record<string, unknown> | undefined;
  const chatId = chat?.id as number | undefined;

  if (!text || !chatId) return NextResponse.json({ ok: true });

  // Ожидаем /start CODE
  const match = text.match(/^\/start\s+(\d{6})$/);
  if (!match) {
    await sendTelegramMessage(chatId, 'Отправьте команду из CRM для привязки аккаунта.');
    return NextResponse.json({ ok: true });
  }

  const code = match[1];
  const supabase = await createClient();

  const { data: verification } = await supabase
    .from('telegram_verifications')
    .select('user_id, expires_at')
    .eq('code', code)
    .single();

  if (!verification) {
    await sendTelegramMessage(chatId, '❌ Код не найден или уже использован.');
    return NextResponse.json({ ok: true });
  }

  if (new Date(verification.expires_at) < new Date()) {
    await sendTelegramMessage(chatId, '❌ Код истёк. Запросите новый в CRM.');
    await supabase.from('telegram_verifications').delete().eq('code', code);
    return NextResponse.json({ ok: true });
  }

  await supabase
    .from('profiles')
    .update({ telegram_chat_id: chatId })
    .eq('id', verification.user_id);

  await supabase.from('telegram_verifications').delete().eq('code', code);

  await sendTelegramMessage(chatId, '✅ Telegram успешно привязан к вашему CRM аккаунту!');

  return NextResponse.json({ ok: true });
}
