import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import {
  DayValues, FIELD_TO_COLUMN, FUNNEL_INPUT_FIELDS, SalesPlan, earnings, isValidMonth, monthWeeks,
} from '@/lib/sales-funnel';

const ALMATY_OFFSET_MS = 5 * 3_600_000;

interface PlanRow {
  manager_id: string;
  leads_plan: number;
  sales_plan: number;
  avg_check: number;
  ad_budget_plan: number;
}

interface ClientRow {
  id: string;
  full_name: string | null;
  group_name: string | null;
  sold_by_id: string;
  purchase_date: string;
  payment_amount: number | null;
  status: string;
}

function nextMonthStart(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

function toPlan(rows: PlanRow[]): SalesPlan | null {
  if (rows.length === 0) return null;
  const sales = rows.reduce((a, r) => a + r.sales_plan, 0);
  const payment = rows.reduce((a, r) => a + r.sales_plan * r.avg_check, 0);
  return {
    leadsPlan: rows.reduce((a, r) => a + r.leads_plan, 0),
    salesPlan: sales,
    avgCheck: sales ? Math.round(payment / sales) : 0,
    adBudgetPlan: rows.reduce((a, r) => a + r.ad_budget_plan, 0),
  };
}

function addTo(target: Record<string, DayValues>, day: string, key: string, value: number) {
  const cur = target[day] || {};
  target[day] = { ...cur, [key]: (Number(cur[key as keyof DayValues]) || 0) + value };
}

/**
 * GET /api/sales-funnel?month=YYYY-MM&managerId=<id|all>
 * A sales manager always gets their own funnel; an admin picks a manager or
 * «all» (team sum). Sales and payments are counted from clients.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRoles('ADMIN', 'SALES_MANAGER');
    const supabase = await createClient();
    const month = request.nextUrl.searchParams.get('month');
    if (!isValidMonth(month)) {
      return NextResponse.json({ message: 'Некорректный формат месяца (YYYY-MM)' }, { status: 400 });
    }
    const isAdmin = user.role === 'ADMIN';
    const requested = request.nextUrl.searchParams.get('managerId') || (isAdmin ? 'all' : user.id);
    const selected = isAdmin ? requested : user.id;
    const from = `${month}-01`;
    const to = nextMonthStart(month);

    // Plans and sales are fetched for the whole month (small sets) so an admin's
    // manager list stays complete; then narrowed to the selected manager.
    let daysQ = supabase.from('sales_funnel_days').select('*').gte('day', from).lt('day', to);
    if (selected !== 'all') daysQ = daysQ.eq('manager_id', selected);
    let plansQ = supabase.from('sales_plans').select('manager_id, leads_plan, sales_plan, avg_check, ad_budget_plan').eq('month', month);
    let clientsQ = supabase
      .from('clients')
      .select('id, full_name, group_name, sold_by_id, purchase_date, payment_amount, status')
      .not('sold_by_id', 'is', null)
      .gte('purchase_date', from)
      .lt('purchase_date', to)
      // Newest first: the month's sales list shows the latest sales on top.
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (!isAdmin) {
      plansQ = plansQ.eq('manager_id', user.id);
      clientsQ = clientsQ.eq('sold_by_id', user.id);
    }

    const [plansRes, daysRes, clientsRes, mopsRes] = await Promise.all([
      plansQ, daysQ, clientsQ,
      isAdmin ? supabase.from('profiles').select('id').eq('role', 'SALES_MANAGER') : Promise.resolve({ data: [], error: null }),
    ]);
    for (const r of [plansRes, daysRes, clientsRes, mopsRes]) if (r.error) throw r.error;

    const allPlans = (plansRes.data || []) as PlanRow[];
    const allClients = (clientsRes.data || []) as ClientRow[];
    const plans = selected === 'all' ? allPlans : allPlans.filter((p) => p.manager_id === selected);
    const clients = selected === 'all' ? allClients : allClients.filter((c) => c.sold_by_id === selected);

    // Managers in the month: sales-manager role, anyone with a plan, anyone who sold.
    const managerIds = new Set<string>([user.id]);
    if (isAdmin) {
      (mopsRes.data || []).forEach((p: { id: string }) => managerIds.add(p.id));
      allPlans.forEach((p) => managerIds.add(p.manager_id));
      allClients.forEach((c) => managerIds.add(c.sold_by_id));
    }
    const { data: profiles, error: profErr } = await supabase
      .from('profiles').select('id, full_name').in('id', Array.from(managerIds));
    if (profErr) throw profErr;
    const nameOf = new Map((profiles || []).map((p) => [p.id, (p.full_name || '').trim()]));

    const days: Record<string, DayValues> = {};
    for (const row of daysRes.data || []) {
      for (const field of FUNNEL_INPUT_FIELDS) {
        const v = row[FIELD_TO_COLUMN[field]];
        if (v !== null && v !== undefined) addTo(days, row.day, field, Number(v));
      }
    }
    // Ad budget as entered: USD and the rate it was converted at (KZT is in days.adBudget).
    const adUsd: Record<string, { usd: number; rate: number | null }> = {};
    for (const row of daysRes.data || []) {
      if (row.ad_budget_usd === null || row.ad_budget_usd === undefined) continue;
      const cur = adUsd[row.day] || { usd: 0, rate: null };
      adUsd[row.day] = { usd: Math.round((cur.usd + Number(row.ad_budget_usd)) * 100) / 100, rate: row.usd_rate ? Number(row.usd_rate) : cur.rate };
    }
    for (const c of clients) {
      addTo(days, c.purchase_date.slice(0, 10), 'sales', 1);
      addTo(days, c.purchase_date.slice(0, 10), 'payment', Number(c.payment_amount) || 0);
    }
    const perManager = new Map<string, { sales: number; payment: number }>();
    for (const c of allClients) {
      const cur = perManager.get(c.sold_by_id) || { sales: 0, payment: 0 };
      perManager.set(c.sold_by_id, { sales: cur.sales + 1, payment: cur.payment + (Number(c.payment_amount) || 0) });
    }

    const payment = clients.reduce((a, c) => a + (Number(c.payment_amount) || 0), 0);
    const managers = isAdmin
      ? Array.from(managerIds)
          .filter((id) => id !== user.id || allPlans.some((p) => p.manager_id === id) || perManager.has(id))
          .map((id) => {
            const plan = allPlans.find((p) => p.manager_id === id);
            return {
              id,
              fullName: nameOf.get(id) || '—',
              salesPlan: plan?.sales_plan ?? 0,
              sales: perManager.get(id)?.sales ?? 0,
              payment: perManager.get(id)?.payment ?? 0,
            };
          })
          .sort((a, b) => b.sales - a.sales || a.fullName.localeCompare(b.fullName))
      : [];

    return NextResponse.json({
      month,
      selected,
      isAdmin,
      today: new Date(Date.now() + ALMATY_OFFSET_MS).toISOString().slice(0, 10),
      weeks: monthWeeks(month),
      plan: toPlan(plans),
      managerPlans: isAdmin ? allPlans.map((p) => ({
        managerId: p.manager_id, leadsPlan: p.leads_plan, salesPlan: p.sales_plan,
        avgCheck: p.avg_check, adBudgetPlan: p.ad_budget_plan,
      })) : [],
      days,
      adUsd,
      managers,
      clients: clients.map((c) => ({
        id: c.id,
        name: (c.group_name || c.full_name || 'без названия').trim(),
        date: c.purchase_date.slice(0, 10),
        amount: Number(c.payment_amount) || 0,
        status: c.status,
        managerName: nameOf.get(c.sold_by_id) || '—',
      })),
      earnings: selected === 'all' ? null : earnings(payment, clients.length),
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
