import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramKeyboard, sendTelegramReplyKeyboard, forwardMessage } from '@/lib/telegram';
import { createCreativeRequestedNotification } from '@/lib/notifications';
import { CREATIVE_TYPE_LABELS } from '@/lib/constants';
import { IDLE_TARGETOLOGIST_KEYBOARD } from '../keyboards';
import { escapeHtml, formatAlmatyTime } from '../format';

interface CreateRequestParams {
  clientId: string;
  clientName: string;
  type: string;
  description: string | null;
  requestedById: string;
  requesterName: string;
  requesterChatId: number;
  briefChatId: number;
  briefMessageIds: number[];
}

interface Designer {
  id: string;
  full_name: string;
  telegram_chat_id: number | null;
}

// The designer assigned to the client owns its creatives; the per-type
// designer is only a fallback for clients that don't have one yet.
async function findResponsibleDesigner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  clientId: string,
  type: string,
): Promise<Designer | null> {
  const { data: client } = await supabase
    .from('clients')
    .select('designer:profiles!clients_designer_id_fkey(id, full_name, telegram_chat_id)')
    .eq('id', clientId)
    .single();
  const clientDesigner = (client as unknown as { designer: Designer | null } | null)?.designer;
  if (clientDesigner) return clientDesigner;

  const { data: assignment } = await supabase
    .from('creative_type_assignments')
    .select('designer:profiles!creative_type_assignments_designer_id_fkey(id, full_name, telegram_chat_id)')
    .eq('type', type)
    .single();
  return (assignment as unknown as { designer: Designer | null } | null)?.designer ?? null;
}

// Shared by both paths that end a "what do you need" flow: the brief
// already existed for this client, or the brief was just submitted.
export async function createCreativeRequestAndNotify(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  params: CreateRequestParams,
): Promise<void> {
  const {
    clientId, clientName, type, description, requestedById, requesterName,
    requesterChatId, briefChatId, briefMessageIds,
  } = params;

  const typeLabel = CREATIVE_TYPE_LABELS[type] || type;

  const designer = await findResponsibleDesigner(supabase, clientId, type);

  if (!designer) {
    await sendTelegramReplyKeyboard(
      requesterChatId,
      `⚠️ У клиента «${escapeHtml(clientName)}» нет дизайнера, и на тип «${typeLabel}» тоже никто не назначен. `
        + 'Попросите руководителя назначить дизайнера на клиента в CRM.',
      IDLE_TARGETOLOGIST_KEYBOARD,
    );
    return;
  }

  const { data: request, error } = await supabase
    .from('creative_requests')
    .insert({ client_id: clientId, type, description, requested_by_id: requestedById, designer_id: designer.id })
    .select('id, created_at')
    .single();

  if (error || !request) {
    await sendTelegramReplyKeyboard(requesterChatId, '⚠️ Не удалось создать заявку, попробуйте ещё раз.', IDLE_TARGETOLOGIST_KEYBOARD);
    return;
  }

  const designerChatId = designer.telegram_chat_id;
  if (designerChatId) {
    for (const messageId of briefMessageIds) {
      await forwardMessage(designerChatId, briefChatId, messageId);
    }
    await sendTelegramKeyboard(
      designerChatId,
      `🎨 <b>Заявка от ${escapeHtml(requesterName)}</b>\n`
        + `Клиент: <b>${escapeHtml(clientName)}</b>\nТип: ${typeLabel}\n`
        + `🕒 Поступила: ${formatAlmatyTime(request.created_at)}`
        + (description ? `\n\n📝 ${escapeHtml(description)}` : ''),
      [[{ text: '✅ Принять в работу', callback_data: `accept:${request.id}` }]],
    );
  }

  await createCreativeRequestedNotification(supabase, {
    designerId: designer.id,
    clientId,
    clientName,
    type,
    requesterName,
  });

  await sendTelegramReplyKeyboard(
    requesterChatId,
    `✅ Заявка отправлена: ${escapeHtml(designer.full_name)}`,
    IDLE_TARGETOLOGIST_KEYBOARD,
  );
}
