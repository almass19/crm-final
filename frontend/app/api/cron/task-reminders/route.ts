import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/telegram';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = await createClient();

  const today = new Date().toISOString().split('T')[0];

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, client_id, assignee_id, profiles!tasks_assignee_id_fkey(telegram_chat_id)')
    .eq('due_date', today)
    .neq('status', 'DONE')
    .not('assignee_id', 'is', null);

  if (error) {
    return NextResponse.json({ message: 'Ошибка запроса', error: error.message }, { status: 500 });
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ notified: 0 });
  }

  let notified = 0;

  for (const task of tasks) {
    if (!task.assignee_id) continue;

    const profileData = task.profiles as unknown;
    const assignee = Array.isArray(profileData) ? profileData[0] as { telegram_chat_id: number | null } | null : profileData as { telegram_chat_id: number | null } | null;
    const title = '📋 Дедлайн задачи сегодня';
    const message = `Задача "${task.title}" должна быть выполнена сегодня.`;

    await supabase.from('notifications').insert({
      user_id: task.assignee_id,
      type: 'TASK_DUE',
      title,
      message,
      link: `/clients/${task.client_id}`,
    });

    if (assignee?.telegram_chat_id) {
      await sendTelegramMessage(assignee.telegram_chat_id, `${title}\n${message}`);
    }

    notified++;
  }

  return NextResponse.json({ notified });
}
