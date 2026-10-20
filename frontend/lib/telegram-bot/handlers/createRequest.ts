import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramKeyboard, sendTelegramReplyKeyboard, forwardMessage } from '@/lib/telegram';
import { createCreativeRequestedNotification } from '@/lib/notifications';
import { CREATIVE_TYPE_LABELS } from '@/lib/constants';
import { IDLE_TARGETOLOGIST_KEYBOARD } from '../keyboards';

interface CreateRequestParams {
  clientId: string;
  clientName: string;
  type: string;
  requestedById: string;
  requesterName: string;
  requesterChatId: number;
  briefChatId: number;
  briefMessageIds: number[];
}

// Shared by both paths that end a "what do you need" flow: the brief
// already existed for this client, or the brief was just submitted.
export async function createCreativeRequestAndNotify(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  params: CreateRequestParams,
): Promise<void> {
  const {
    clientId, clientName, type, requestedById, requesterName,
    requesterChatId, briefChatId, briefMessageIds,
  } = params;

  const typeLabel = CREATIVE_TYPE_LABELS[type] || type;

  const { data: assignmentRaw } = await supabase
    .from('creative_type_assignments')
    .select('designer_id, designer:profiles!creative_type_assignments_designer_id_fkey(id, full_name, telegram_chat_id)')
    .eq('type', type)
    .single();

  const assignment = assignmentRaw as unknown as {
    designer_id: string;
    designer: { id: string; full_name: string; telegram_chat_id: number | null } | null;
  } | null;

  if (!assignment?.designer) {
    await sendTelegramReplyKeyboard(
      requesterChatId,
      `⚠️ На тип «${typeLabel}» ещё не назначен дизайнер. Попросите руководителя назначить его в CRM → «Типы креативов».`,
      IDLE_TARGETOLOGIST_KEYBOARD,
    );
    return;
  }

  const { data: request, error } = await supabase
    .from('creative_requests')
    .insert({ client_id: clientId, type, requested_by_id: requestedById, designer_id: assignment.designer_id })
    .select('id')
    .single();

  if (error || !request) {
    await sendTelegramReplyKeyboard(requesterChatId, '⚠️ Не удалось создать заявку, попробуйте ещё раз.', IDLE_TARGETOLOGIST_KEYBOARD);
    return;
  }

  const designerChatId = assignment.designer.telegram_chat_id as number | null;
  if (designerChatId) {
    for (const messageId of briefMessageIds) {
      await forwardMessage(designerChatId, briefChatId, messageId);
    }
    await sendTelegramKeyboard(
      designerChatId,
      `🎨 Заявка от ${requesterName}\nКлиент: ${clientName}\nТип: ${typeLabel}`,
      [[{ text: '✅ Принять в работу', callback_data: `accept:${request.id}` }]],
    );
  }

  await createCreativeRequestedNotification(supabase, {
    designerId: assignment.designer_id,
    clientId,
    clientName,
    type,
    requesterName,
  });

  await sendTelegramReplyKeyboard(
    requesterChatId,
    `✅ Заявка отправлена: ${assignment.designer.full_name}`,
    IDLE_TARGETOLOGIST_KEYBOARD,
  );
}
