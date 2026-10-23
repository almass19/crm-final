import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage, sendTelegramReplyKeyboard, type TelegramBot } from '@/lib/telegram';
import { IDLE_TARGETOLOGIST_KEYBOARD } from '../keyboards';

const CREATIVE_BOT_ROLES = ['TARGETOLOGIST', 'DESIGNER', 'LEAD_DESIGNER'];

export function creativeBotUsername(): string {
  return process.env.TELEGRAM_CREATIVE_BOT_USERNAME || 'resultingagency_bot';
}

// Links the chat to a CRM account by the one-time code from the CRM. Works
// from either bot — the chat_id is the same in both — and answers through
// the bot the code was sent to.
export async function handleStartCommand(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  code: string,
  bot: TelegramBot = 'creative',
): Promise<void> {
  const { data: verification } = await supabase
    .from('telegram_verifications')
    .select('user_id, expires_at')
    .eq('code', code)
    .single();

  if (!verification) {
    await sendTelegramMessage(chatId, '❌ Код не найден или уже использован.', bot);
    return;
  }

  if (new Date(verification.expires_at) < new Date()) {
    await sendTelegramMessage(chatId, '❌ Код истёк. Запросите новый в CRM.', bot);
    await supabase.from('telegram_verifications').delete().eq('code', code);
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .update({ telegram_chat_id: chatId })
    .eq('id', verification.user_id)
    .select('role')
    .single();

  await supabase.from('telegram_verifications').delete().eq('code', code);

  const successText = '✅ Telegram успешно привязан к вашему CRM аккаунту!';
  if (bot === 'notifications') {
    const hint = CREATIVE_BOT_ROLES.includes(profile?.role ?? '')
      ? `\n\nКреативы заказываются и сдаются в @${creativeBotUsername()} — откройте его и нажмите «Start».`
      : '';
    await sendTelegramMessage(chatId, successText + hint, 'notifications');
    return;
  }
  if (profile?.role === 'TARGETOLOGIST') {
    await sendTelegramReplyKeyboard(chatId, successText, IDLE_TARGETOLOGIST_KEYBOARD);
  } else {
    await sendTelegramMessage(chatId, successText);
  }
}
