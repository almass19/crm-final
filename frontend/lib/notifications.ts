import { SupabaseClient } from '@supabase/supabase-js';

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
  await supabase.from('notifications').insert({
    user_id: assigneeId,
    type: 'TASK_ASSIGNED',
    title: 'Новая задача',
    message: `${assignerName} назначил вам задачу: ${taskTitle}`,
    link: `/clients/${clientId}`,
  });
}
