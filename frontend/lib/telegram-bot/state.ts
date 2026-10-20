import type { SupabaseClient } from '@supabase/supabase-js';

// Ephemeral per-chat conversation state — one row per active chat, cleared
// on completion or /cancel. Keeps the multi-message collection flows
// (brief, delivery) simple: the next incoming message is interpreted
// according to whatever state is on file for that chat_id.
export type BotState =
  | 'AWAITING_CLIENT_SEARCH'
  | 'AWAITING_TYPE'
  | 'AWAITING_BRIEF'
  | 'AWAITING_DELIVERY';

export interface BotStateRow {
  state: BotState;
  context: Record<string, unknown>;
}

export async function getBotState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
): Promise<BotStateRow | null> {
  const { data } = await supabase
    .from('telegram_bot_state')
    .select('state, context')
    .eq('chat_id', chatId)
    .single();
  return (data as BotStateRow) || null;
}

export async function setBotState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  state: BotState,
  context: Record<string, unknown> = {},
): Promise<void> {
  await supabase
    .from('telegram_bot_state')
    .upsert({ chat_id: chatId, state, context, updated_at: new Date().toISOString() });
}

export async function clearBotState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
): Promise<void> {
  await supabase.from('telegram_bot_state').delete().eq('chat_id', chatId);
}
