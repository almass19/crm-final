import type { SupabaseClient } from '@supabase/supabase-js';
import { answerCallbackQuery, editMessageReplyMarkup, sendTelegramMessage, sendTelegramReplyKeyboard } from '@/lib/telegram';
import { getBotState, clearBotState } from './state';
import { getProfileByChatId } from './profile';
import {
  IDLE_TARGETOLOGIST_KEYBOARD,
  CANCEL_BUTTON,
  MY_REQUESTS_BUTTON,
  MY_TASKS_BUTTON,
  DESIGNER_ROLES,
  REQUESTER_ROLES,
} from './keyboards';
import { handleStartCommand } from './handlers/linkAccount';
import {
  isNewCreativeTrigger,
  startNewCreativeFlow,
  sendClientListPage,
  handleClientSearch,
  handleClientPicked,
  handleTypePicked,
  handleDescription,
  handleDescriptionMessage,
} from './handlers/newRequest';
import { sendTargetologistRequests, sendDesignerTasks } from './handlers/requestLists';
import { sendIdle } from './idle';
import { collectBriefMessage, finalizeBrief } from './handlers/brief';
import {
  handleAccept,
  handleDeliverStart,
  collectDeliveryMessage,
  finalizeDelivery,
} from './handlers/acceptDeliver';
import {
  isTopicCommand,
  handleTopicRegistration,
  sendTopicListPage,
  handleCaseTopicPicked,
  handleCaseSkip,
  handleCaseNewStart,
  handleCaseNewName,
} from './handlers/caseTopics';
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

  // As a group admin the bot sees every message in the portfolio group —
  // the only thing it reacts to there is topic registration.
  if (message.chat.type !== 'private') {
    if (isTopicCommand(text)) await handleTopicRegistration(supabase, message);
    return;
  }

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

  const isRequester = REQUESTER_ROLES.includes(profile.role ?? '');

  if (text === '/start') {
    await sendIdle(
      chatId,
      isRequester
        ? 'Готово! Здесь вы заказываете креативы у дизайнеров.'
        : 'Готово! Сюда будут приходить заявки на креативы.',
      profile.role,
    );
    return;
  }

  if (text === '/cancel' || text === CANCEL_BUTTON) {
    await clearBotState(supabase, chatId);
    await sendIdle(chatId, 'Отменено.', profile.role);
    return;
  }

  // Read-only lists work from any state — checked before the state switch
  // so the button text isn't swallowed as a brief or delivery message.
  if (text === MY_REQUESTS_BUTTON && isRequester) {
    await sendTargetologistRequests(supabase, profile, chatId);
    return;
  }
  if (text === MY_TASKS_BUTTON && DESIGNER_ROLES.includes(profile.role ?? '')) {
    await sendDesignerTasks(supabase, profile, chatId);
    return;
  }

  const stateRow = await getBotState(supabase, chatId);

  if (!stateRow) {
    if (isRequester && isNewCreativeTrigger(text)) {
      await startNewCreativeFlow(supabase, chatId, profile.id);
      return;
    }
    if (isRequester) {
      await sendTelegramReplyKeyboard(chatId, 'Нажмите кнопку ниже, чтобы запросить креатив у дизайнера.', IDLE_TARGETOLOGIST_KEYBOARD);
    } else if (DESIGNER_ROLES.includes(profile.role ?? '')) {
      await sendIdle(chatId, 'Нажмите «Мои задачи», чтобы увидеть заявки.', profile.role);
    }
    return;
  }

  switch (stateRow.state) {
    case 'AWAITING_CLIENT_SEARCH':
      await handleClientSearch(supabase, profile, chatId, message);
      return;
    case 'AWAITING_DESCRIPTION':
      await handleDescriptionMessage(supabase, profile, chatId, message, stateRow);
      return;
    case 'AWAITING_BRIEF':
      if (text || hasMedia(message)) await collectBriefMessage(supabase, chatId, message, stateRow);
      return;
    case 'AWAITING_DELIVERY':
      if (text || hasMedia(message)) await collectDeliveryMessage(supabase, chatId, message, stateRow);
      return;
    case 'AWAITING_CASE_TOPIC_NAME':
      await handleCaseNewName(supabase, chatId, message, stateRow);
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
    await answerCallbackQuery(callbackQuery.id);
    if (stateRow?.state !== 'AWAITING_TYPE') return;
    await handleTypePicked(supabase, chatId, stateRow, data.slice('type:'.length));
    return;
  }

  if (data === 'desc_skip') {
    const stateRow = await getBotState(supabase, chatId);
    await answerCallbackQuery(callbackQuery.id);
    if (stateRow?.state !== 'AWAITING_DESCRIPTION') return;
    if (messageId) await editMessageReplyMarkup(chatId, messageId, []);
    await handleDescription(supabase, profile, chatId, stateRow, null);
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

  if (data.startsWith('case:')) {
    const stateRow = await getBotState(supabase, chatId);
    await handleCaseTopicPicked(supabase, chatId, messageId, callbackQuery.id, stateRow, data.slice('case:'.length));
    return;
  }

  if (data.startsWith('case_list:')) {
    const offset = parseInt(data.slice('case_list:'.length), 10) || 0;
    await answerCallbackQuery(callbackQuery.id);
    await sendTopicListPage(supabase, chatId, offset);
    return;
  }

  if (data === 'case_new') {
    const stateRow = await getBotState(supabase, chatId);
    await handleCaseNewStart(supabase, chatId, callbackQuery.id, stateRow);
    return;
  }

  if (data === 'case_skip') {
    const stateRow = await getBotState(supabase, chatId);
    await handleCaseSkip(supabase, chatId, messageId, callbackQuery.id, stateRow);
    return;
  }

  if (data === 'deliver_done') {
    const stateRow = await getBotState(supabase, chatId);
    if (!stateRow) return;
    await finalizeDelivery(supabase, profile, chatId, stateRow);
    return;
  }
}
