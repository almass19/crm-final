import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRoles('ADMIN');
    const { id } = await params;
    const supabase = await createClient();

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', id)
      .single();

    if (!client) {
      return NextResponse.json({ message: 'Клиент не найден' }, { status: 404 });
    }

    await supabase.from('audit_logs').insert({
      action: 'CLIENT_ARCHIVED',
      user_id: user.id,
      client_id: id,
      details: 'Клиент архивирован',
    });

    const { data: updated, error } = await supabase
      .from('clients')
      .update({ archived: true })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json(snakeToCamel(updated));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRoles('ADMIN');
    const { id } = await params;
    const supabase = await createClient();

    const { data: client } = await supabase
      .from('clients')
      .select('id, status')
      .eq('id', id)
      .single();

    if (!client) {
      return NextResponse.json({ message: 'Клиент не найден' }, { status: 404 });
    }

    await supabase.from('audit_logs').insert({
      action: 'CLIENT_UNARCHIVED',
      user_id: user.id,
      client_id: id,
      details: 'Клиент разархивирован',
    });

    // A DONE status keeps a client in the archive view regardless of the
    // archived flag (see GET /api/clients), so resume it into active work.
    const updateData: Record<string, unknown> = { archived: false };
    if (client.status === 'DONE') updateData.status = 'IN_WORK';

    const { data: updated, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json(snakeToCamel(updated));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
