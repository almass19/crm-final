import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id: clientId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        client:clients!tasks_client_id_fkey(id, full_name, company_name),
        creator:profiles!tasks_creator_id_fkey(id, full_name, role),
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, role)
      `)
      .eq('client_id', clientId)
      .order('status', { ascending: true })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
