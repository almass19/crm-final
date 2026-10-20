import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  editMessageReplyMarkup,
  forwardMessage,
  sendTelegramKeyboard,
  sendTelegramMessage,
  sendTelegramReplyKeyboard,
  clearTelegramReplyKeyboard,
} from '@/lib/telegram';
import { createCreativeAcceptedNotification, createCreativeDeliveredNotification } from '@/lib/notifications';
import { CREATIVE_TYPE_LABELS } from '@/lib/constants';
import { setBotState, clearBotState, type BotStateRow } from '../state';
import { CANCEL_KEYBOARD } from '../keyboards';
import type { TelegramMessage } from '../types';
import type { BotProfile } from '../profile';

export async function handleAccept(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  profile: BotProfile,
  chatId: number,
  messageId: number,
  callbackQueryId: string,
  requestId: string,
): Promise<void> {
  const { data: requestRaw } = await supabase
    .from('creative_requests')
    .select(`
      id, status, type, client_id, requested_by_id, designer_id,
      client:clients(id, full_name, company_name)
    `)
    .eq('id', requestId)
    .single();

  const request = requestRaw as unknown as {
    id: string;
    status: string;
    type: string;
    client_id: string;
    requested_by_id: string;
    designer_id: string;
    client: { id: string; full_name: string | null; company_name: string | null };
  } | null;

  if (!request) {
    await answerCallbackQuery(callbackQueryId, 'Заявка не найдена');
    return;
  }

  if (request.designer_id !== profile.id) {
    await answerCallbackQuery(callbackQueryId, 'Это не ваша заявка');
    return;
  }

  if (request.status !== 'PENDING') {
    await answerCallbackQuery(callbackQueryId, 'Уже обработано');
    return;
  }

  await supabase
    .from('creative_requests')
    .update({ status: 'ACCEPTED', accepted_at: new Date().toISOString() })
    .eq('id', requestId);

  await answerCallbackQuery(callbackQueryId, 'Принято');
  await editMessageReplyMarkup(chatId, messageId, []);

  const clientName = request.client.company_name || request.client.full_name || '—';
  const typeLabel = CREATIVE_TYPE_LABELS[request.type] || request.type;

  await sendTelegramKeyboard(
    chatId,
    `📎 ${clientName} — ${typeLabel}\nКогда будет готово — нажмите кнопку и пришлите файл(ы).`,
    [[{ text: '📎 Готово, отправляю', callback_data: `deliver_start:${requestId}` }]],
  );

  await createCreativeAcceptedNotification(supabase, {
    requestedById: request.requested_by_id,
    clientId: request.client_id,
    clientName,
    type: request.type,
    designerName: profile.full_name,
  });
}

export async function handleDeliverStart(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  callbackQueryId: string,
  requestId: string,
): Promise<void> {
  await setBotState(supabase, chatId, 'AWAITING_DELIVERY', { requestId, messageIds: [] });
  await answerCallbackQuery(callbackQueryId);
  await sendTelegramKeyboard(
    chatId,
    'Пришлите готовый креатив (одним или несколькими сообщениями), затем нажмите «Готово».',
    [[{ text: '✅ Готово', callback_data: 'deliver_done' }]],
  );
  // Inline and reply keyboards can't share one message — this short
  // follow-up just establishes the persistent "Отмена" button.
  await sendTelegramReplyKeyboard(chatId, 'Или нажмите «Отмена», чтобы прервать.', CANCEL_KEYBOARD);
}

export async function collectDeliveryMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  message: TelegramMessage,
  stateRow: BotStateRow,
): Promise<void> {
  const messageIds = [...((stateRow.context.messageIds as number[]) || []), message.message_id];
  await setBotState(supabase, chatId, 'AWAITING_DELIVERY', { ...stateRow.context, messageIds });
}

export async function finalizeDelivery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  profile: BotProfile,
  chatId: number,
  stateRow: BotStateRow,
): Promise<void> {
  const { requestId, messageIds } = stateRow.context as { requestId: string; messageIds?: number[] };

  if (!messageIds || messageIds.length === 0) {
    await sendTelegramMessage(chatId, 'Сначала пришлите готовый файл — хотя бы одно сообщение.');
    return;
  }

  const { data: requestRaw } = await supabase
    .from('creative_requests')
    .select(`
      id, type, client_id, requested_by_id,
      client:clients(id, full_name, company_name),
      requester:profiles!creative_requests_requested_by_id_fkey(id, full_name, telegram_chat_id)
    `)
    .eq('id', requestId)
    .single();

  const request = requestRaw as unknown as {
    id: string;
    type: string;
    client_id: string;
    requested_by_id: string;
    client: { id: string; full_name: string | null; company_name: string | null };
    requester: { id: string; full_name: string; telegram_chat_id: number | null } | null;
  } | null;

  if (!request) {
    await clearBotState(supabase, chatId);
    await clearTelegramReplyKeyboard(chatId, 'Заявка не найдена.');
    return;
  }

  const clientName = request.client.company_name || request.client.full_name || '—';
  const typeLabel = CREATIVE_TYPE_LABELS[request.type] || request.type;
  const requesterChatId = request.requester?.telegram_chat_id as number | null;

  if (requesterChatId) {
    for (const messageId of messageIds) {
      await forwardMessage(requesterChatId, chatId, messageId);
    }
    await sendTelegramMessage(
      requesterChatId,
      `✅ Готово: ${clientName} — ${typeLabel}\nФайлы выше ⬆️ — не забудьте выложить в группу с кейсами.`,
    );
  }

  const month = new Date().toISOString().slice(0, 7);
  await supabase.from('creatives').insert({
    client_id: request.client_id,
    designer_id: profile.id,
    count: 1,
    month,
    type: request.type,
  });

  await supabase
    .from('creative_requests')
    .update({ status: 'DELIVERED', delivered_at: new Date().toISOString() })
    .eq('id', requestId);

  await clearBotState(supabase, chatId);
  await clearTelegramReplyKeyboard(chatId, '✅ Отправлено таргетологу и записано.');

  await createCreativeDeliveredNotification(supabase, {
    requestedById: request.requested_by_id,
    clientId: request.client_id,
    clientName,
    type: request.type,
    designerName: profile.full_name,
  });
}
