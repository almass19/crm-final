import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

function sanitizeClient(client: Record<string, unknown>, role: string | null) {
  if (role === 'SPECIALIST' || role === 'DESIGNER') {
    const { payment_amount, ...rest } = client;
    return rest;
  }
  return client;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const supabase = await createClient();

    const { data: client, error } = await supabase
      .from('clients')
      .select(`
        *,
        created_by:profiles!clients_created_by_id_fkey(id, full_name, role),
        sold_by:profiles!clients_sold_by_id_fkey(id, full_name),
        assigned_to:profiles!clients_assigned_to_id_fkey(id, full_name, role),
        designer:profiles!clients_designer_id_fkey(id, full_name, role),
        assignment_history(
          id, type, assigned_at,
          specialist:profiles!assignment_history_specialist_id_fkey(full_name),
          designer:profiles!assignment_history_designer_id_fkey(full_name),
          assigned_by:profiles!assignment_history_assigned_by_id_fkey(full_name)
        )
      `)
      .eq('id', id)
      .order('assigned_at', { referencedTable: 'assignment_history', ascending: false })
      .single();

    if (error || !client) {
      return NextResponse.json({ message: 'Клиент не найден' }, { status: 404 });
    }

    if (user.role === 'SPECIALIST' && client.assigned_to_id !== user.id) {
      return NextResponse.json({ message: 'Нет доступа к данному клиенту' }, { status: 403 });
    }

    if (user.role === 'DESIGNER' && client.designer_id !== user.id) {
      return NextResponse.json({ message: 'Нет доступа к данному клиенту' }, { status: 403 });
    }

    const sanitized = sanitizeClient(client as Record<string, unknown>, user.role);
    return NextResponse.json(snakeToCamel(sanitized));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();

    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (!client) {
      return NextResponse.json({ message: 'Клиент не найден' }, { status: 404 });
    }

    if (user.role === 'SPECIALIST' && client.assigned_to_id !== user.id) {
      return NextResponse.json({ message: 'Нет доступа к данному клиенту' }, { status: 403 });
    }

    if (user.role === 'DESIGNER' && client.designer_id !== user.id) {
      return NextResponse.json({ message: 'Нет доступа к данному клиенту' }, { status: 403 });
    }

    // Only ADMIN and SALES_MANAGER can edit client fields
    const editableFields = ['fullName', 'companyName', 'phone', 'groupName', 'services', 'notes'];
    const hasEditFields = editableFields.some(f => body[f] !== undefined);
    if (hasEditFields && user.role !== 'ADMIN' && user.role !== 'SALES_MANAGER') {
      return NextResponse.json({ message: 'Недостаточно прав' }, { status: 403 });
    }

    if (body.soldById !== undefined && user.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'Только администратор может менять продавца' },
        { status: 403 },
      );
    }

    if (body.status && user.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'Только администратор может менять статус клиента' },
        { status: 403 },
      );
    }

    if (body.paymentAmount !== undefined && user.role !== 'ADMIN' && user.role !== 'SALES_MANAGER') {
      return NextResponse.json(
        { message: 'Только администратор или менеджер может менять сумму оплаты' },
        { status: 403 },
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (body.fullName !== undefined) updateData.full_name = body.fullName;
    if (body.companyName !== undefined) updateData.company_name = body.companyName;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.groupName !== undefined) updateData.group_name = body.groupName;
    if (body.services !== undefined) updateData.services = body.services;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.paymentAmount !== undefined) updateData.payment_amount = body.paymentAmount;
    if (body.soldById !== undefined) updateData.sold_by_id = body.soldById || null;

    const { data: updated, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        created_by:profiles!clients_created_by_id_fkey(full_name),
        sold_by:profiles!clients_sold_by_id_fkey(full_name),
        assigned_to:profiles!clients_assigned_to_id_fkey(full_name),
        designer:profiles!clients_designer_id_fkey(full_name)
      `)
      .single();

    if (error) throw error;

    if (body.status) {
      await supabase.from('audit_logs').insert({
        action: 'STATUS_CHANGED',
        user_id: user.id,
        client_id: id,
        details: `Статус изменён: ${client.status} → ${body.status}`,
      });
    }

    const sanitized = sanitizeClient(updated as Record<string, unknown>, user.role);
    return NextResponse.json(snakeToCamel(sanitized));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
