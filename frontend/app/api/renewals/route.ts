import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    if (user.role !== 'ADMIN' && user.role !== 'TARGETOLOGIST' && user.role !== 'LEAD_DESIGNER') {
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
      .select('client_id, amount, created_at')
      .eq('is_renewal', true)
      .eq('month', month)
      .order('created_at', { ascending: false });

    if (user.role === 'TARGETOLOGIST') {
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

    // payments is already ordered newest-first, so the first amount seen per
    // client is that client's most recent renewal payment this month.
    const lastRenewalAmountByClient = new Map<string, number>();
    for (const p of payments || []) {
      if (!lastRenewalAmountByClient.has(p.client_id)) {
        lastRenewalAmountByClient.set(p.client_id, Number(p.amount) || 0);
      }
    }

    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select(`
        *,
        created_by:profiles!clients_created_by_id_fkey(full_name),
        sold_by:profiles!clients_sold_by_id_fkey(full_name),
        assigned_to:profiles!clients_assigned_to_id_fkey(id, full_name),
        designer:profiles!clients_designer_id_fkey(id, full_name)
      `)
      .in('id', clientIds)
      .order('created_at', { ascending: false });

    if (clientsError) throw clientsError;

    const clientsWithRenewalAmount = (clients || []).map((c) => ({
      ...c,
      last_renewal_amount: lastRenewalAmountByClient.get(c.id) ?? null,
    }));

    return NextResponse.json({
      month,
      totalRenewals: clientIds.length,
      clients: snakeToCamel(clientsWithRenewalAmount),
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
