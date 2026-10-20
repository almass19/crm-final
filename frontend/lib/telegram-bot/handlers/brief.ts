import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram';
import { setBotState, clearBotState, type BotStateRow } from '../state';
import { createCreativeRequestAndNotify } from './createRequest';
import type { TelegramMessage } from '../types';
import type { BotProfile } from '../profile';

export async function collectBriefMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  message: TelegramMessage,
  stateRow: BotStateRow,
): Promise<void> {
  const messageIds = [...((stateRow.context.messageIds as number[]) || []), message.message_id];
  await setBotState(supabase, chatId, 'AWAITING_BRIEF', { ...stateRow.context, messageIds });
}

export async function finalizeBrief(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  profile: BotProfile,
  chatId: number,
  stateRow: BotStateRow,
): Promise<void> {
  const { clientId, clientName, type, messageIds } = stateRow.context as {
    clientId: string;
    clientName: string;
    type: string;
    messageIds?: number[];
  };

  if (!messageIds || messageIds.length === 0) {
    await sendTelegramMessage(chatId, 'Сначала пришлите бриф — хотя бы одно сообщение.');
    return;
  }

  await supabase.from('client_creative_briefs').upsert({
    client_id: clientId,
    from_chat_id: chatId,
    message_ids: messageIds,
    submitted_by_id: profile.id,
  });

  await clearBotState(supabase, chatId);

  await createCreativeRequestAndNotify(supabase, {
    clientId,
    clientName,
    type,
    requestedById: profile.id,
    requesterName: profile.full_name,
    requesterChatId: chatId,
    briefChatId: chatId,
    briefMessageIds: messageIds,
  });
}
