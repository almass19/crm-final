import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram';

// Unchanged logic, moved out of the webhook route so it lives alongside the
// rest of the bot's command handlers.
export async function handleStartCommand(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  code: string,
): Promise<void> {
  const { data: verification } = await supabase
    .from('telegram_verifications')
    .select('user_id, expires_at')
    .eq('code', code)
    .single();

  if (!verification) {
    await sendTelegramMessage(chatId, '❌ Код не найден или уже использован.');
    return;
  }

  if (new Date(verification.expires_at) < new Date()) {
    await sendTelegramMessage(chatId, '❌ Код истёк. Запросите новый в CRM.');
    await supabase.from('telegram_verifications').delete().eq('code', code);
    return;
  }

  await supabase
    .from('profiles')
    .update({ telegram_chat_id: chatId })
    .eq('id', verification.user_id);

  await supabase.from('telegram_verifications').delete().eq('code', code);

  await sendTelegramMessage(chatId, '✅ Telegram успешно привязан к вашему CRM аккаунту!');
}
