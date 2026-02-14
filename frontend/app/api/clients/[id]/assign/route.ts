import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRoles('ADMIN', 'LEAD_DESIGNER');
    const { id: clientId } = await params;
    const { specialistId, designerId } = await request.json();
    const supabase = await createClient();

    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (!client) {
      return NextResponse.json({ message: 'Клиент не найден' }, { status: 404 });
    }

    if (!specialistId && !designerId) {
      return NextResponse.json(
        { message: 'Необходимо указать специалиста или дизайнера' },
        { status: 400 },
      );
    }

    // LEAD_DESIGNER can only assign designers, not specialists
    if (user.role === 'LEAD_DESIGNER' && specialistId) {
      return NextResponse.json(
        { message: 'Главный дизайнер может назначать только дизайнеров' },
        { status: 403 },
      );
    }

    // ADMIN cannot assign designers — only LEAD_DESIGNER can
    if (user.role === 'ADMIN' && designerId) {
      return NextResponse.json(
        { message: 'Назначать дизайнера может только главный дизайнер' },
        { status: 403 },
      );
    }

    const updateData: Record<string, unknown> = {};

    if (specialistId) {
      const { data: specialist } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', specialistId)
        .single();

      if (!specialist || !['SPECIALIST', 'ADMIN'].includes(specialist.role)) {
        return NextResponse.json(
          { message: 'Указанный пользователь не является специалистом' },
          { status: 400 },
        );
      }

      const oldAssignee = client.assigned_to_id;
      updateData.assigned_to_id = specialistId;
      updateData.assigned_at = new Date().toISOString();
      updateData.assignment_seen = false;

      await supabase.from('assignment_history').insert({
        client_id: clientId,
        type: 'SPECIALIST',
        specialist_id: specialistId,
        assigned_by_id: user.id,
      });

      const action = oldAssignee ? 'SPECIALIST_REASSIGNED' : 'SPECIALIST_ASSIGNED';
      await supabase.from('audit_logs').insert({
        action,
        user_id: user.id,
        client_id: clientId,
        details: `Специалист назначен: ${specialist.full_name}`,
      });
    }

    if (designerId) {
      const { data: designer } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', designerId)
        .single();

      if (!designer || (designer.role !== 'DESIGNER' && designer.role !== 'LEAD_DESIGNER')) {
        return NextResponse.json(
          { message: 'Указанный пользователь не является дизайнером' },
          { status: 400 },
        );
      }

      const oldDesigner = client.designer_id;
      updateData.designer_id = designerId;
      updateData.designer_assigned_at = new Date().toISOString();
      updateData.designer_assignment_seen = false;

      await supabase.from('assignment_history').insert({
        client_id: clientId,
        type: 'DESIGNER',
        designer_id: designerId,
        assigned_by_id: user.id,
      });

      const action = oldDesigner ? 'DESIGNER_REASSIGNED' : 'DESIGNER_ASSIGNED';
      await supabase.from('audit_logs').insert({
        action,
        user_id: user.id,
        client_id: clientId,
        details: `Дизайнер назначен: ${designer.full_name}`,
      });
    }

    if (client.status === 'NEW') {
      updateData.status = 'ASSIGNED';
    }

    const { data: updated, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', clientId)
      .select(`
        *,
        created_by:profiles!clients_created_by_id_fkey(full_name),
        assigned_to:profiles!clients_assigned_to_id_fkey(full_name),
        designer:profiles!clients_designer_id_fkey(full_name)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(snakeToCamel(updated));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
