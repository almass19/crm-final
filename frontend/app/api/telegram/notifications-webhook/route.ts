import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram';
import { handleStartCommand, creativeBotUsername } from '@/lib/telegram-bot/handlers/linkAccount';
import { readTelegramUpdate } from '@/lib/telegram-bot/webhook';

// Webhook of the notifications bot (@resulting_notificationbot). It only
// links accounts by the code from the CRM; everything else lives in the
// creative bot.
export async function POST(request: NextRequest) {
  const update = await readTelegramUpdate(request);
  if (update instanceof NextResponse) return update;

  const message = update.message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const text = message.text?.trim();

  try {
    const startMatch = text?.match(/^\/start\s+(\d{6})$/);
    if (startMatch) {
      await handleStartCommand(createAdminClient(), chatId, startMatch[1], 'notifications');
    } else if (text === '/start') {
      await sendTelegramMessage(chatId, 'Отправьте команду из CRM для привязки аккаунта.', 'notifications');
    } else {
      await sendTelegramMessage(
        chatId,
        `Этот бот только присылает уведомления CRM. Креативы — в @${creativeBotUsername()}.`,
        'notifications',
      );
    }
  } catch (e) {
    console.error('Telegram notifications webhook error:', e);
  }

  return NextResponse.json({ ok: true });
}
