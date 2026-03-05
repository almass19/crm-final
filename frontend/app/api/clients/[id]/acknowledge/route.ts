import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRoles('SPECIALIST', 'DESIGNER', 'ADMIN');
    const { id: clientId } = await params;
    const supabase = await createClient();

    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (!client) {
      return NextResponse.json({ message: 'Клиент не найден' }, { status: 404 });
    }

    // ADMIN acting as specialist if assigned to client, otherwise designer fallback
    const isAssignedAsDesigner = client.designer_id === user.id && client.assigned_to_id !== user.id;
    const type = isAssignedAsDesigner ? 'designer' : 'specialist';

    if (type === 'specialist') {
      if (client.assigned_to_id !== user.id) {
        return NextResponse.json(
          { message: 'Вы не назначены на данного клиента как специалист' },
          { status: 403 },
        );
      }
      if (client.assignment_seen) {
        return NextResponse.json(
          { message: 'Назначение уже подтверждено' },
          { status: 400 },
        );
      }

      await supabase
        .from('clients')
        .update({ assignment_seen: true, status: 'IN_WORK' })
        .eq('id', clientId);

      await supabase.from('audit_logs').insert({
        action: 'SPECIALIST_ACKNOWLEDGED',
        user_id: user.id,
        client_id: clientId,
        details: 'Специалист принял клиента в работу',
      });
    } else {
      if (client.designer_id !== user.id) {
        return NextResponse.json(
          { message: 'Вы не назначены на данного клиента как дизайнер' },
          { status: 403 },
        );
      }
      if (client.designer_assignment_seen) {
        return NextResponse.json(
          { message: 'Назначение дизайнера уже подтверждено' },
          { status: 400 },
        );
      }

      await supabase
        .from('clients')
        .update({ designer_assignment_seen: true })
        .eq('id', clientId);

      await supabase.from('audit_logs').insert({
        action: 'DESIGNER_ACKNOWLEDGED',
        user_id: user.id,
        client_id: clientId,
        details: 'Дизайнер принял клиента в работу',
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
