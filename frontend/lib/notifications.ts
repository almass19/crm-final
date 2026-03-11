import { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from './telegram';

interface TaskAssignedParams {
  assigneeId: string;
  taskTitle: string;
  clientId: string;
  assignerName: string;
}

export async function createTaskAssignedNotification(
  supabase: SupabaseClient,
  { assigneeId, taskTitle, clientId, assignerName }: TaskAssignedParams,
) {
  const title = 'Новая задача';
  const message = `${assignerName} назначил вам задачу: ${taskTitle}`;

  await supabase.from('notifications').insert({
    user_id: assigneeId,
    type: 'TASK_ASSIGNED',
    title,
    message,
    link: `/clients/${clientId}`,
  });

  const { data: profile } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', assigneeId)
    .single();

  if (profile?.telegram_chat_id) {
    await sendTelegramMessage(profile.telegram_chat_id, `${title}\n${message}`);
  }
}

interface ClientAssignedParams {
  assigneeId: string;
  clientId: string;
  clientName: string;
  assignerName: string;
  role: 'specialist' | 'designer';
}

export async function createClientAssignedNotification(
  supabase: SupabaseClient,
  { assigneeId, clientId, clientName, assignerName, role }: ClientAssignedParams,
) {
  const title = role === 'specialist' ? 'Назначен клиент' : 'Назначен клиент (дизайн)';
  const message = `${assignerName} назначил вам клиента: ${clientName}`;

  await supabase.from('notifications').insert({
    user_id: assigneeId,
    type: role === 'specialist' ? 'CLIENT_ASSIGNED' : 'CLIENT_DESIGNER_ASSIGNED',
    title,
    message,
    link: `/clients/${clientId}`,
  });

  const { data: profile } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', assigneeId)
    .single();

  if (profile?.telegram_chat_id) {
    await sendTelegramMessage(profile.telegram_chat_id, `${title}\n${message}`);
  }
}
