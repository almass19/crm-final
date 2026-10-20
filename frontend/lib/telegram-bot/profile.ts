import type { SupabaseClient } from '@supabase/supabase-js';

export interface BotProfile {
  id: string;
  full_name: string;
  role: string | null;
}

export async function getProfileByChatId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
): Promise<BotProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('telegram_chat_id', chatId)
    .single();
  return (data as BotProfile) || null;
}
