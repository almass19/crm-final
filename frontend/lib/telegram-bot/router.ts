import type { SupabaseClient } from '@supabase/supabase-js';
import { answerCallbackQuery, sendTelegramMessage, sendTelegramReplyKeyboard, clearTelegramReplyKeyboard } from '@/lib/telegram';
import { getBotState, clearBotState } from './state';
import { getProfileByChatId } from './profile';
import { IDLE_TARGETOLOGIST_KEYBOARD, CANCEL_BUTTON } from './keyboards';
import { handleStartCommand } from './handlers/linkAccount';
import {
  isNewCreativeTrigger,
  startNewCreativeFlow,
  sendClientListPage,
  handleClientSearch,
  handleClientPicked,
  handleTypePicked,
} from './handlers/newRequest';
import { collectBriefMessage, finalizeBrief } from './handlers/brief';
import {
  handleAccept,
  handleDeliverStart,
  collectDeliveryMessage,
  finalizeDelivery,
} from './handlers/acceptDeliver';
import { hasMedia, type TelegramUpdate, type TelegramCallbackQuery } from './types';

export async function routeUpdate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  update: TelegramUpdate,
): Promise<void> {
  if (update.callback_query) {
    await routeCallbackQuery(supabase, update.callback_query);
    return;
  }

  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id;
  const text = message.text?.trim();

  const startMatch = text?.match(/^\/start\s+(\d{6})$/);
  if (startMatch) {
    await handleStartCommand(supabase, chatId, startMatch[1]);
    return;
  }

  const profile = await getProfileByChatId(supabase, chatId);
  if (!profile) {
    await sendTelegramMessage(chatId, 'Сначала привяжите Telegram в CRM (раздел уведомлений), затем вернитесь сюда.');
    return;
  }

  if (text === '/start') {
    if (profile.role === 'TARGETOLOGIST') {
      await sendTelegramReplyKeyboard(chatId, 'Готово! Здесь вы заказываете креативы у дизайнеров.', IDLE_TARGETOLOGIST_KEYBOARD);
    } else {
      await sendTelegramMessage(chatId, 'Готово! Сюда будут приходить заявки на креативы.');
    }
    return;
  }

  if (text === '/cancel' || text === CANCEL_BUTTON) {
    await clearBotState(supabase, chatId);
    if (profile.role === 'TARGETOLOGIST') {
      await sendTelegramReplyKeyboard(chatId, 'Отменено.', IDLE_TARGETOLOGIST_KEYBOARD);
    } else {
      await clearTelegramReplyKeyboard(chatId, 'Отменено.');
    }
    return;
  }

  const stateRow = await getBotState(supabase, chatId);

  if (!stateRow) {
    if (profile.role === 'TARGETOLOGIST' && isNewCreativeTrigger(text)) {
      await startNewCreativeFlow(supabase, chatId, profile.id);
      return;
    }
    if (profile.role === 'TARGETOLOGIST') {
      await sendTelegramReplyKeyboard(chatId, 'Нажмите кнопку ниже, чтобы запросить креатив у дизайнера.', IDLE_TARGETOLOGIST_KEYBOARD);
    }
    return;
  }

  switch (stateRow.state) {
    case 'AWAITING_CLIENT_SEARCH':
      await handleClientSearch(supabase, profile, chatId, message);
      return;
    case 'AWAITING_BRIEF':
      if (text || hasMedia(message)) await collectBriefMessage(supabase, chatId, message, stateRow);
      return;
    case 'AWAITING_DELIVERY':
      if (text || hasMedia(message)) await collectDeliveryMessage(supabase, chatId, message, stateRow);
      return;
    default:
      return;
  }
}

async function routeCallbackQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  callbackQuery: TelegramCallbackQuery,
): Promise<void> {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message?.chat.id;
  const messageId = callbackQuery.message?.message_id;
  if (!data || !chatId) return;

  const profile = await getProfileByChatId(supabase, chatId);
  if (!profile) {
    await answerCallbackQuery(callbackQuery.id, 'Аккаунт не привязан');
    return;
  }

  if (data.startsWith('client:')) {
    await handleClientPicked(supabase, chatId, data.slice('client:'.length));
    return;
  }

  if (data.startsWith('clients_page:')) {
    const offset = parseInt(data.slice('clients_page:'.length), 10) || 0;
    await answerCallbackQuery(callbackQuery.id);
    await sendClientListPage(supabase, chatId, profile.id, offset);
    return;
  }

  if (data.startsWith('type:')) {
    const stateRow = await getBotState(supabase, chatId);
    if (!stateRow) return;
    await handleTypePicked(supabase, profile, chatId, stateRow, data.slice('type:'.length));
    return;
  }

  if (data === 'brief_done') {
    const stateRow = await getBotState(supabase, chatId);
    if (!stateRow) return;
    await finalizeBrief(supabase, profile, chatId, stateRow);
    return;
  }

  if (data.startsWith('accept:') && messageId) {
    await handleAccept(supabase, profile, chatId, messageId, callbackQuery.id, data.slice('accept:'.length));
    return;
  }

  if (data.startsWith('deliver_start:')) {
    await handleDeliverStart(supabase, chatId, callbackQuery.id, data.slice('deliver_start:'.length));
    return;
  }

  if (data === 'deliver_done') {
    const stateRow = await getBotState(supabase, chatId);
    if (!stateRow) return;
    await finalizeDelivery(supabase, profile, chatId, stateRow);
    return;
  }
}
