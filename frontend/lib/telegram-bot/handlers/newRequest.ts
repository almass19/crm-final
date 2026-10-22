import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramKeyboard, sendTelegramMessage, sendTelegramReplyKeyboard, type InlineButton } from '@/lib/telegram';
import { CREATIVE_TYPE_LABELS } from '@/lib/constants';
import { escapePostgrestValue } from '@/lib/utils/postgrest-filter';
import { setBotState, clearBotState, type BotStateRow } from '../state';
import { createCreativeRequestAndNotify } from './createRequest';
import { NEW_CREATIVE_BUTTON, CANCEL_KEYBOARD, IDLE_TARGETOLOGIST_KEYBOARD } from '../keyboards';
import type { TelegramMessage } from '../types';
import type { BotProfile } from '../profile';

const CLIENT_SEARCH_LIMIT = 8;
const CLIENT_LIST_PAGE_SIZE = 8;
// Closed or paused accounts — a targetologist can't order creatives for them
const INACTIVE_CLIENT_STATUSES = ['DONE', 'REJECTED', 'REFUND', 'PAUSED'] as const;
const INACTIVE_STATUS_FILTER = `(${INACTIVE_CLIENT_STATUSES.join(',')})`;

export function isNewCreativeTrigger(text: string | undefined): boolean {
  if (!text) return false;
  const normalized = text.replace(/^🎨\s*/, '').trim().toLowerCase();
  return normalized === 'новый креатив' || text === NEW_CREATIVE_BUTTON;
}

export async function startNewCreativeFlow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  targetologistId: string,
): Promise<void> {
  await setBotState(supabase, chatId, 'AWAITING_CLIENT_SEARCH');
  await sendTelegramReplyKeyboard(chatId, 'Выберите клиента ниже или напишите название для поиска.', CANCEL_KEYBOARD);
  await sendClientListPage(supabase, chatId, targetologistId, 0);
}

// Shown right after "Новый креатив" (offset 0) and via the pagination
// buttons — only active (non-archived, not closed) clients, so the list stays usable
// even for a targetologist with a large book of archived/done accounts.
export async function sendClientListPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  targetologistId: string,
  offset: number,
): Promise<void> {
  const { data: clients, count } = await supabase
    .from('clients')
    .select('id, full_name, company_name', { count: 'exact' })
    .eq('assigned_to_id', targetologistId)
    .eq('archived', false)
    .not('status', 'in', INACTIVE_STATUS_FILTER)
    .order('company_name', { ascending: true })
    .range(offset, offset + CLIENT_LIST_PAGE_SIZE - 1);

  if (!clients || clients.length === 0) {
    await sendTelegramMessage(chatId, offset === 0 ? 'У вас нет активных клиентов.' : 'Это все клиенты.');
    return;
  }

  const buttons: InlineButton[][] = clients.map(
    (c: { id: string; full_name: string | null; company_name: string | null }) => [
      { text: c.company_name || c.full_name || '—', callback_data: `client:${c.id}` },
    ],
  );

  const navRow: InlineButton[] = [];
  if (offset > 0) {
    navRow.push({ text: '◀️ Назад', callback_data: `clients_page:${Math.max(0, offset - CLIENT_LIST_PAGE_SIZE)}` });
  }
  if (count != null && offset + CLIENT_LIST_PAGE_SIZE < count) {
    navRow.push({ text: 'Дальше ▶️', callback_data: `clients_page:${offset + CLIENT_LIST_PAGE_SIZE}` });
  }
  if (navRow.length > 0) buttons.push(navRow);

  await sendTelegramKeyboard(chatId, 'Ваши клиенты:', buttons);
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
    .eq('archived', false)
    .not('status', 'in', INACTIVE_STATUS_FILTER)
    .or(`company_name.ilike.${safeQuery},full_name.ilike.${safeQuery}`)
    .limit(CLIENT_SEARCH_LIMIT);

  if (!clients || clients.length === 0) {
    await sendTelegramMessage(chatId, 'Ничего не найдено среди ваших активных клиентов. Попробуйте другое название или /cancel.');
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
    .select('id, full_name, company_name, archived, status')
    .eq('id', clientId)
    .single();

  if (!client) {
    await clearBotState(supabase, chatId);
    await sendTelegramReplyKeyboard(chatId, 'Клиент не найден, начните заново.', IDLE_TARGETOLOGIST_KEYBOARD);
    return;
  }

  // Buttons from an old list may point to a client that has since been closed
  if (client.archived || (INACTIVE_CLIENT_STATUSES as readonly string[]).includes(client.status)) {
    await clearBotState(supabase, chatId);
    await sendTelegramReplyKeyboard(chatId, 'Клиент неактивен — креатив для него заказать нельзя.', IDLE_TARGETOLOGIST_KEYBOARD);
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
