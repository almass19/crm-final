import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id: clientId } = await params;
    const supabase = await createClient();

    if (user.role === 'DESIGNER') {
      return NextResponse.json(
        { message: 'Недостаточно прав для просмотра платежей' },
        { status: 403 },
      );
    }

    // Targetologist can only see payments for their assigned client
    if (user.role === 'TARGETOLOGIST') {
      const { data: client } = await supabase
        .from('clients')
        .select('assigned_to_id')
        .eq('id', clientId)
        .single();
      if (!client || client.assigned_to_id !== user.id) {
        return NextResponse.json(
          { message: 'Нет доступа к данному клиенту' },
          { status: 403 },
        );
      }
    }

    let query = supabase
      .from('payments')
      .select(`
        *,
        manager:profiles!payments_manager_id_fkey(id, full_name)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    // Sales manager sees only their own payments
    if (user.role === 'SALES_MANAGER') {
      query = query.eq('manager_id', user.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id: clientId } = await params;

    if (user.role !== 'ADMIN' && user.role !== 'SALES_MANAGER') {
      return NextResponse.json(
        { message: 'Недостаточно прав для создания платежа' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const supabase = await createClient();

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (!client) {
      return NextResponse.json({ message: 'Клиент не найден' }, { status: 404 });
    }

    if (!body.amount || body.amount < 1) {
      return NextResponse.json(
        { message: 'Сумма должна быть больше 0' },
        { status: 400 },
      );
    }

    if (!body.paymentDate || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(body.paymentDate)) {
      return NextResponse.json(
        { message: 'Дата должна быть в формате YYYY-MM-DD' },
        { status: 400 },
      );
    }

    const month = body.paymentDate.slice(0, 7);

    const { data, error } = await supabase
      .from('payments')
      .insert({
        amount: body.amount,
        month,
        payment_date: body.paymentDate,
        is_renewal: body.isRenewal ?? false,
        client_id: clientId,
        manager_id: user.id,
      })
      .select(`
        *,
        client:clients!payments_client_id_fkey(id, full_name, company_name),
        manager:profiles!payments_manager_id_fkey(id, full_name)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
