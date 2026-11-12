import type { SupabaseClient } from '@supabase/supabase-js';
import { answerCallbackQuery, editMessageReplyMarkup, sendTelegramKeyboard, sendTelegramMessage } from '@/lib/telegram';
import { createCreativeCancelledNotification } from '@/lib/notifications';
import { CREATIVE_TYPE_LABELS } from '@/lib/constants';
import { escapeHtml } from '../format';
import type { BotProfile } from '../profile';

// Requests that stopped being relevant: the designer, the one who ordered
// it, or an admin can drop it. Kept as CANCELLED rather than deleted so the
// history stays.
const OPEN_STATUSES = ['PENDING', 'ACCEPTED'];

interface CancellableRequest {
  id: string;
  status: string;
  type: string;
  client_id: string;
  designer_id: string;
  requested_by_id: string;
  client: { full_name: string | null; company_name: string | null } | null;
}

async function loadCancellable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  profile: BotProfile,
  callbackQueryId: string,
  requestId: string,
): Promise<CancellableRequest | null> {
  const { data } = await supabase
    .from('creative_requests')
    .select('id, status, type, client_id, designer_id, requested_by_id, client:clients(full_name, company_name)')
    .eq('id', requestId)
    .single();
  const request = data as unknown as CancellableRequest | null;

  if (!request) {
    await answerCallbackQuery(callbackQueryId, 'Заявка не найдена');
    return null;
  }
  const isParticipant = profile.id === request.designer_id || profile.id === request.requested_by_id;
  if (!isParticipant && profile.role !== 'ADMIN') {
    await answerCallbackQuery(callbackQueryId, 'Это не ваша заявка');
    return null;
  }
  if (!OPEN_STATUSES.includes(request.status)) {
    await answerCallbackQuery(callbackQueryId, 'Заявка уже закрыта');
    return null;
  }
  return request;
}

function describe(request: CancellableRequest): { clientName: string; typeLabel: string } {
  return {
    clientName: request.client?.company_name || request.client?.full_name || '—',
    typeLabel: CREATIVE_TYPE_LABELS[request.type] || request.type,
  };
}

export async function handleCancelAsk(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  profile: BotProfile,
  chatId: number,
  callbackQueryId: string,
  requestId: string,
): Promise<void> {
  const request = await loadCancellable(supabase, profile, callbackQueryId, requestId);
  if (!request) return;

  await answerCallbackQuery(callbackQueryId);
  const { clientName, typeLabel } = describe(request);
  await sendTelegramKeyboard(
    chatId,
    `Удалить заявку «${escapeHtml(clientName)} — ${typeLabel}»?`,
    [[
      { text: '🗑 Да, удалить', callback_data: `cancel_yes:${request.id}` },
      { text: 'Нет', callback_data: 'cancel_no' },
    ]],
  );
}

export async function handleCancelConfirm(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  profile: BotProfile,
  chatId: number,
  messageId: number | undefined,
  callbackQueryId: string,
  requestId: string,
): Promise<void> {
  const request = await loadCancellable(supabase, profile, callbackQueryId, requestId);
  if (!request) return;

  // Guarded on status so a delivery finishing at the same moment wins.
  const { data: updated } = await supabase
    .from('creative_requests')
    .update({ status: 'CANCELLED' })
    .eq('id', requestId)
    .in('status', OPEN_STATUSES)
    .select('id');

  if (!updated || updated.length === 0) {
    await answerCallbackQuery(callbackQueryId, 'Заявка уже закрыта');
    return;
  }

  await answerCallbackQuery(callbackQueryId, 'Удалено');
  if (messageId) await editMessageReplyMarkup(chatId, messageId, []);

  const { clientName, typeLabel } = describe(request);
  await sendTelegramMessage(chatId, `🗑 Заявка удалена: ${escapeHtml(clientName)} — ${typeLabel}`);

  const recipients = [request.designer_id, request.requested_by_id]
    .filter((id, i, all) => id !== profile.id && all.indexOf(id) === i);
  for (const userId of recipients) {
    await createCreativeCancelledNotification(supabase, {
      userId,
      clientId: request.client_id,
      clientName,
      type: request.type,
      cancelledByName: profile.full_name,
    });
  }
}

export async function handleCancelDismiss(
  chatId: number,
  messageId: number | undefined,
  callbackQueryId: string,
): Promise<void> {
  await answerCallbackQuery(callbackQueryId);
  if (messageId) await editMessageReplyMarkup(chatId, messageId, []);
}
