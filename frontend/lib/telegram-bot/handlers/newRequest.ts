import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  editTelegramKeyboardMessage,
  sendTelegramKeyboard,
  sendTelegramMessage,
  sendTelegramReplyKeyboard,
  type InlineButton,
} from '@/lib/telegram';
import { CREATIVE_TYPE_LABELS } from '@/lib/constants';
import { escapePostgrestValue } from '@/lib/utils/postgrest-filter';
import { escapeHtml } from '../format';
import { setBotState, clearBotState, type BotStateRow } from '../state';
import { createCreativeRequestAndNotify } from './createRequest';
import { withFlowMessages, getFlowMessageIds, deleteFlowMessages } from '../flowMessages';
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
  triggerMessageId: number,
): Promise<void> {
  await setBotState(supabase, chatId, 'AWAITING_CLIENT_SEARCH', withFlowMessages({}, triggerMessageId));
  const promptId = await sendTelegramReplyKeyboard(chatId, 'Выберите клиента ниже или напишите название для поиска.', CANCEL_KEYBOARD);
  const page = await buildClientListPage(supabase, targetologistId, 0);
  const listId = page.buttons
    ? await sendTelegramKeyboard(chatId, page.text, page.buttons)
    : await sendTelegramMessage(chatId, page.text);
  await setBotState(supabase, chatId, 'AWAITING_CLIENT_SEARCH', withFlowMessages({}, triggerMessageId, promptId, listId));
}

interface ClientListPage {
  text: string;
  buttons: InlineButton[][] | null;
}

// Shown right after "Новый креатив" (offset 0) and via the pagination
// buttons — only active (non-archived, not closed) clients, so the list stays usable
// even for a targetologist with a large book of archived/done accounts.
async function buildClientListPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  targetologistId: string,
  offset: number,
): Promise<ClientListPage> {
  const { data: clients, count } = await supabase
    .from('clients')
    .select('id, full_name, group_name', { count: 'exact' })
    .eq('assigned_to_id', targetologistId)
    .eq('archived', false)
    .not('status', 'in', INACTIVE_STATUS_FILTER)
    .order('group_name', { ascending: true })
    .range(offset, offset + CLIENT_LIST_PAGE_SIZE - 1);

  if (!clients || clients.length === 0) {
    return { text: offset === 0 ? 'У вас нет активных клиентов.' : 'Это все клиенты.', buttons: null };
  }

  const buttons: InlineButton[][] = clients.map(
    (c: { id: string; full_name: string | null; group_name: string | null }) => [
      { text: c.group_name || c.full_name || '—', callback_data: `client:${c.id}` },
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

  return { text: 'Ваши клиенты:', buttons };
}

// Pagination edits the list message in place instead of stacking a new one.
export async function handleClientListPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  messageId: number | undefined,
  callbackQueryId: string,
  targetologistId: string,
  offset: number,
): Promise<void> {
  const page = await buildClientListPage(supabase, targetologistId, offset);
  if (!page.buttons || !messageId) {
    await answerCallbackQuery(callbackQueryId, page.text);
    return;
  }
  await answerCallbackQuery(callbackQueryId);
  await editTelegramKeyboardMessage(chatId, messageId, page.text, page.buttons);
}

export async function handleClientSearch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  profile: BotProfile,
  chatId: number,
  message: TelegramMessage,
  stateRow: BotStateRow,
): Promise<void> {
  const reply = await searchClients(supabase, profile.id, message.text?.trim());
  const replyId = reply.buttons
    ? await sendTelegramKeyboard(chatId, reply.text, reply.buttons)
    : await sendTelegramMessage(chatId, reply.text);
  await setBotState(
    supabase,
    chatId,
    'AWAITING_CLIENT_SEARCH',
    withFlowMessages(stateRow.context, message.message_id, replyId),
  );
}

async function searchClients(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  targetologistId: string,
  query: string | undefined,
): Promise<ClientListPage> {
  if (!query) {
    return { text: 'Напишите название компании или имя клиента текстом.', buttons: null };
  }

  const safeQuery = escapePostgrestValue(`%${query}%`);
  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, group_name')
    .eq('assigned_to_id', targetologistId)
    .eq('archived', false)
    .not('status', 'in', INACTIVE_STATUS_FILTER)
    .or(`group_name.ilike.${safeQuery},full_name.ilike.${safeQuery}`)
    .limit(CLIENT_SEARCH_LIMIT);

  if (!clients || clients.length === 0) {
    return { text: 'Ничего не найдено среди ваших активных клиентов. Попробуйте другое название или /cancel.', buttons: null };
  }

  const buttons = clients.map((c: { id: string; full_name: string | null; group_name: string | null }) => [
    { text: c.group_name || c.full_name || '—', callback_data: `client:${c.id}` },
  ]);
  return { text: 'Выберите клиента:', buttons };
}

export async function handleClientPicked(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  stateRow: BotStateRow | null,
  clientId: string,
): Promise<void> {
  const flowContext = stateRow?.context ?? {};
  const { data: client } = await supabase
    .from('clients')
    .select('id, full_name, group_name, archived, status')
    .eq('id', clientId)
    .single();

  if (!client) {
    await clearBotState(supabase, chatId);
    await deleteFlowMessages(chatId, getFlowMessageIds(flowContext));
    await sendTelegramReplyKeyboard(chatId, 'Клиент не найден, начните заново.', IDLE_TARGETOLOGIST_KEYBOARD);
    return;
  }

  // Buttons from an old list may point to a client that has since been closed
  if (client.archived || (INACTIVE_CLIENT_STATUSES as readonly string[]).includes(client.status)) {
    await clearBotState(supabase, chatId);
    await deleteFlowMessages(chatId, getFlowMessageIds(flowContext));
    await sendTelegramReplyKeyboard(chatId, 'Клиент неактивен — креатив для него заказать нельзя.', IDLE_TARGETOLOGIST_KEYBOARD);
    return;
  }

  const clientName = client.group_name || client.full_name || '—';
  const buttons = Object.entries(CREATIVE_TYPE_LABELS).map(([type, label]) => [
    { text: label, callback_data: `type:${type}` },
  ]);
  const promptId = await sendTelegramKeyboard(chatId, `Клиент: ${escapeHtml(clientName)}\nЧто нужно?`, buttons);
  // Only the tracked ids carry over — the rest of the context starts fresh
  await setBotState(supabase, chatId, 'AWAITING_TYPE', {
    ...withFlowMessages({ flowMessageIds: getFlowMessageIds(flowContext) }, promptId),
    clientId,
    clientName,
  });
}

const DESCRIPTION_MAX_LENGTH = 1000;

export async function handleTypePicked(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  stateRow: BotStateRow,
  type: string,
): Promise<void> {
  const { clientId, clientName } = stateRow.context as { clientId: string; clientName: string };
  const promptId = await sendTelegramKeyboard(
    chatId,
    `Клиент: ${escapeHtml(clientName)} — ${CREATIVE_TYPE_LABELS[type] || type}\nОпишите запрос: что нужно сделать, акцент, сроки.`,
    [[{ text: '⏭ Без описания', callback_data: 'desc_skip' }]],
  );
  await setBotState(supabase, chatId, 'AWAITING_DESCRIPTION', {
    ...withFlowMessages(stateRow.context, promptId),
    clientId,
    clientName,
    type,
  });
}

// Text typed at the description step. Anything but text is rejected —
// files belong in the client brief, which comes next if there isn't one.
export async function handleDescriptionMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  profile: BotProfile,
  chatId: number,
  message: TelegramMessage,
  stateRow: BotStateRow,
): Promise<void> {
  const description = message.text?.trim();
  if (!description) {
    const hintId = await sendTelegramMessage(chatId, 'Опишите запрос текстом или нажмите «Без описания».');
    await setBotState(supabase, chatId, 'AWAITING_DESCRIPTION', withFlowMessages(stateRow.context, message.message_id, hintId));
    return;
  }
  const tracked = { ...stateRow, context: withFlowMessages(stateRow.context, message.message_id) };
  await handleDescription(supabase, profile, chatId, tracked, description.slice(0, DESCRIPTION_MAX_LENGTH));
}

export async function handleDescription(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  profile: BotProfile,
  chatId: number,
  stateRow: BotStateRow,
  description: string | null,
): Promise<void> {
  const { clientId, clientName, type } = stateRow.context as { clientId: string; clientName: string; type: string };

  const { data: brief } = await supabase
    .from('client_creative_briefs')
    .select('from_chat_id, message_ids')
    .eq('client_id', clientId)
    .single();

  if (!brief) {
    const promptId = await sendTelegramKeyboard(
      chatId,
      `Это первый запрос по клиенту «${escapeHtml(clientName)}». Пришлите бриф (текст, фото, файлы — сколько угодно сообщений), затем нажмите «Готово».`,
      [[{ text: '✅ Бриф готов', callback_data: 'brief_done' }]],
    );
    await setBotState(supabase, chatId, 'AWAITING_BRIEF', {
      ...withFlowMessages(stateRow.context, promptId),
      clientId,
      clientName,
      type,
      description,
      messageIds: [],
    });
    return;
  }

  await clearBotState(supabase, chatId);
  await createCreativeRequestAndNotify(supabase, {
    clientId,
    clientName,
    type,
    description,
    requestedById: profile.id,
    requesterName: profile.full_name,
    requesterChatId: chatId,
    briefChatId: brief.from_chat_id,
    briefMessageIds: brief.message_ids,
    flowMessageIds: getFlowMessageIds(stateRow.context),
  });
}
