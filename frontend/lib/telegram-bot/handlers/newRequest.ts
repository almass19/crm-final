import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramKeyboard, sendTelegramMessage } from '@/lib/telegram';
import { CREATIVE_TYPE_LABELS } from '@/lib/constants';
import { escapePostgrestValue } from '@/lib/utils/postgrest-filter';
import { setBotState, clearBotState, type BotStateRow } from '../state';
import { createCreativeRequestAndNotify } from './createRequest';
import type { TelegramMessage } from '../types';
import type { BotProfile } from '../profile';

const CLIENT_SEARCH_LIMIT = 8;

export function isNewCreativeTrigger(text: string | undefined): boolean {
  if (!text) return false;
  return text.replace(/^🎨\s*/, '').trim().toLowerCase() === 'новый креатив';
}

export async function startNewCreativeFlow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
): Promise<void> {
  await setBotState(supabase, chatId, 'AWAITING_CLIENT_SEARCH');
  await sendTelegramMessage(chatId, 'Напишите название компании или имя клиента для поиска (или /cancel).');
}

export async function handleClientSearch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  profile: BotProfile,
  chatId: number,
  message: TelegramMessage,
): Promise<void> {
  const query = message.text?.trim();
  if (!query) {
    await sendTelegramMessage(chatId, 'Напишите название компании или имя клиента текстом.');
    return;
  }

  const safeQuery = escapePostgrestValue(`%${query}%`);
  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, company_name')
    .eq('assigned_to_id', profile.id)
    .or(`company_name.ilike.${safeQuery},full_name.ilike.${safeQuery}`)
    .limit(CLIENT_SEARCH_LIMIT);

  if (!clients || clients.length === 0) {
    await sendTelegramMessage(chatId, 'Ничего не найдено среди ваших клиентов. Попробуйте другое название или /cancel.');
    return;
  }

  const buttons = clients.map((c: { id: string; full_name: string | null; company_name: string | null }) => [
    { text: c.company_name || c.full_name || '—', callback_data: `client:${c.id}` },
  ]);
  await sendTelegramKeyboard(chatId, 'Выберите клиента:', buttons);
}

export async function handleClientPicked(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  clientId: string,
): Promise<void> {
  const { data: client } = await supabase
    .from('clients')
    .select('id, full_name, company_name')
    .eq('id', clientId)
    .single();

  if (!client) {
    await sendTelegramMessage(chatId, 'Клиент не найден, начните заново: напишите «Новый креатив».');
    await clearBotState(supabase, chatId);
    return;
  }

  const clientName = client.company_name || client.full_name || '—';
  await setBotState(supabase, chatId, 'AWAITING_TYPE', { clientId, clientName });

  const buttons = Object.entries(CREATIVE_TYPE_LABELS).map(([type, label]) => [
    { text: label, callback_data: `type:${type}` },
  ]);
  await sendTelegramKeyboard(chatId, `Клиент: ${clientName}\nЧто нужно?`, buttons);
}

export async function handleTypePicked(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  profile: BotProfile,
  chatId: number,
  stateRow: BotStateRow,
  type: string,
): Promise<void> {
  const clientId = stateRow.context.clientId as string;
  const clientName = stateRow.context.clientName as string;

  const { data: brief } = await supabase
    .from('client_creative_briefs')
    .select('from_chat_id, message_ids')
    .eq('client_id', clientId)
    .single();

  if (!brief) {
    await setBotState(supabase, chatId, 'AWAITING_BRIEF', { clientId, clientName, type, messageIds: [] });
    await sendTelegramKeyboard(
      chatId,
      `Это первый запрос по клиенту «${clientName}». Пришлите бриф (текст, фото, файлы — сколько угодно сообщений), затем нажмите «Готово».`,
      [[{ text: '✅ Бриф готов', callback_data: 'brief_done' }]],
    );
    return;
  }

  await clearBotState(supabase, chatId);
  await createCreativeRequestAndNotify(supabase, {
    clientId,
    clientName,
    type,
    requestedById: profile.id,
    requesterName: profile.full_name,
    requesterChatId: chatId,
    briefChatId: brief.from_chat_id,
    briefMessageIds: brief.message_ids,
  });
}
