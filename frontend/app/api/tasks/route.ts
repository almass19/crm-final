import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';
import { createTaskAssignedNotification } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const supabase = await createClient();

    if (!body.title || !body.title.trim()) {
      return NextResponse.json(
        { message: 'Название задачи обязательно' },
        { status: 400 },
      );
    }

    if (!body.clientId) {
      return NextResponse.json(
        { message: 'ID клиента обязателен' },
        { status: 400 },
      );
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', body.clientId)
      .single();

    if (!client) {
      return NextResponse.json({ message: 'Клиент не найден' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: body.title,
        description: body.description || null,
        priority: body.priority ?? 50,
        due_date: body.dueDate || null,
        client_id: body.clientId,
        creator_id: user.id,
        assignee_id: body.assigneeId || null,
      })
      .select(`
        *,
        client:clients!tasks_client_id_fkey(id, full_name, company_name),
        creator:profiles!tasks_creator_id_fkey(id, full_name, role),
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, role)
      `)
      .single();

    if (error) throw error;

    if (body.assigneeId && body.assigneeId !== user.id) {
      await createTaskAssignedNotification(supabase, {
        assigneeId: body.assigneeId,
        taskTitle: body.title,
        clientId: body.clientId,
        assignerName: user.fullName,
      });
    }

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
