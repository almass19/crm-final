import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    if (user.role !== 'ADMIN' && user.role !== 'SPECIALIST') {
      return NextResponse.json(
        { message: 'Недостаточно прав для просмотра продлений' },
        { status: 403 },
      );
    }

    const month = request.nextUrl.searchParams.get('month');

    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json(
        { message: 'Некорректный формат месяца (YYYY-MM)' },
        { status: 400 },
      );
    }

    // Get distinct client IDs with renewals in this month
    let paymentsQuery = supabase
      .from('payments')
      .select('client_id')
      .eq('is_renewal', true)
      .eq('month', month);

    if (user.role === 'SPECIALIST') {
      const { data: assignedClients } = await supabase
        .from('clients')
        .select('id')
        .eq('assigned_to_id', user.id);
      const clientIds = (assignedClients || []).map((c) => c.id);
      if (clientIds.length === 0) {
        return NextResponse.json({ month, totalRenewals: 0, clients: [] });
      }
      paymentsQuery = paymentsQuery.in('client_id', clientIds);
    }

    const { data: payments, error: paymentsError } = await paymentsQuery;
    if (paymentsError) throw paymentsError;

    const clientIds = Array.from(new Set((payments || []).map((p) => p.client_id)));
    if (clientIds.length === 0) {
      return NextResponse.json({ month, totalRenewals: 0, clients: [] });
    }

    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select(`
        *,
        created_by:profiles!clients_created_by_id_fkey(full_name),
        sold_by:profiles!clients_sold_by_id_fkey(full_name),
        assigned_to:profiles!clients_assigned_to_id_fkey(full_name),
        designer:profiles!clients_designer_id_fkey(full_name)
      `)
      .in('id', clientIds)
      .eq('archived', false)
      .order('created_at', { ascending: false });

    if (clientsError) throw clientsError;

    return NextResponse.json({
      month,
      totalRenewals: clientIds.length,
      clients: snakeToCamel(clients || []),
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
