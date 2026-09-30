import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';

// Fixed bonus per deal-amount tier. Amounts outside these tiers still show up
// in the breakdown (so the targetologist can see what wasn't counted) but add
// nothing to the total.
const NEW_CLIENT_BONUS: Record<number, number> = { 80000: 10000, 100000: 13000 };
const RENEWAL_BONUS: Record<number, number> = { 80000: 14000, 100000: 16000 };

interface AmountItem {
  id: string;
  name: string;
  amount: number;
}

interface Tier {
  amount: number;
  count: number;
  bonusEach: number;
  bonusTotal: number;
  clients: { id: string; name: string }[];
}

function buildTiers(items: AmountItem[], bonusMap: Record<number, number>): { tiers: Tier[]; total: number } {
  const byAmount = new Map<number, AmountItem[]>();
  for (const item of items) {
    const list = byAmount.get(item.amount) || [];
    list.push(item);
    byAmount.set(item.amount, list);
  }

  const tiers: Tier[] = Array.from(byAmount.entries())
    .map(([amount, list]) => {
      const bonusEach = bonusMap[amount] || 0;
      return {
        amount,
        count: list.length,
        bonusEach,
        bonusTotal: bonusEach * list.length,
        clients: list.map((c) => ({ id: c.id, name: c.name })),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const total = tiers.reduce((sum, t) => sum + t.bonusTotal, 0);
  return { tiers, total };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRoles('TARGETOLOGIST');
    const supabase = await createClient();

    const sp = request.nextUrl.searchParams;
    const year = parseInt(sp.get('year') || '');
    const month = parseInt(sp.get('month') || '');

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { message: 'Некорректные параметры year/month' },
        { status: 400 },
      );
    }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const startDate = `${monthStr}-01`;
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

    // New clients: assigned to this targetologist, purchased this month —
    // counted regardless of archived/status, since the sale already happened.
    const { data: newClientsRaw, error: newError } = await supabase
      .from('clients')
      .select('id, full_name, company_name, payment_amount, purchase_date, status, archived')
      .eq('assigned_to_id', user.id)
      .gte('purchase_date', startDate)
      .lte('purchase_date', endDate);
    if (newError) throw newError;

    const newClientItems: AmountItem[] = (newClientsRaw || [])
      .filter((c) => c.payment_amount != null)
      .map((c) => ({
        id: c.id,
        name: c.company_name || c.full_name || '—',
        amount: Number(c.payment_amount),
      }));

    // Renewals: this targetologist's clients (current assignment, regardless of
    // archived) whose latest renewal payment this month lands on a bonus tier.
    const { data: myClients, error: myClientsError } = await supabase
      .from('clients')
      .select('id, full_name, company_name')
      .eq('assigned_to_id', user.id);
    if (myClientsError) throw myClientsError;

    const myClientMap = new Map((myClients || []).map((c) => [c.id, c]));
    const myClientIds = Array.from(myClientMap.keys());

    let renewalPayments: { client_id: string; amount: number }[] = [];
    if (myClientIds.length > 0) {
      const { data, error } = await supabase
        .from('payments')
        .select('client_id, amount, created_at')
        .eq('is_renewal', true)
        .eq('month', monthStr)
        .in('client_id', myClientIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      renewalPayments = data || [];
    }

    // payments is newest-first, so the first amount seen per client is their
    // most recent renewal payment this month.
    const lastRenewalByClient = new Map<string, number>();
    for (const p of renewalPayments) {
      if (!lastRenewalByClient.has(p.client_id)) {
        lastRenewalByClient.set(p.client_id, Number(p.amount) || 0);
      }
    }

    const renewalItems: AmountItem[] = Array.from(lastRenewalByClient.entries()).map(([clientId, amount]) => {
      const c = myClientMap.get(clientId);
      return {
        id: clientId,
        name: c ? (c.company_name || c.full_name || '—') : '—',
        amount,
      };
    });

    const newClientsResult = buildTiers(newClientItems, NEW_CLIENT_BONUS);
    const renewalsResult = buildTiers(renewalItems, RENEWAL_BONUS);

    return NextResponse.json({
      month,
      year,
      newClients: newClientsResult,
      renewals: renewalsResult,
      totalSalary: newClientsResult.total + renewalsResult.total,
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
