import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { fetchAll } from '@/lib/supabase/fetch-all';
import {
  HIDDEN_PROFILE_IDS, RenewalPayment, ReportClient, payingByMonth, periodBuckets, periodMonths, shiftMonth, summarize,
} from '@/lib/targetologist-report';
import { OpFact, TgFact, yearPlan } from '@/lib/year-plan';
import { OP_SHEETS_2026, SHEET_FACT_UNTIL } from '@/lib/year-plan-2026';

const ALMATY_OFFSET_MS = 5 * 3_600_000;

interface SoldClient {
  sold_by_id: string;
  purchase_date: string;
  payment_amount: number | null;
}

/**
 * GET /api/year-plan?year=YYYY
 * Plan per month (finmodel) next to the CRM fact, for the sales department
 * and the targetologists. Months after the current one have no fact.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRoles('ADMIN');
    const year = Number(request.nextUrl.searchParams.get('year'));
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      return NextResponse.json({ message: 'Некорректный год' }, { status: 400 });
    }
    const supabase = await createClient();
    const from = `${year}-01-01`;
    const to = `${year + 1}-01-01`;

    const [mopsRes, days, sold, clientsAll, paymentsAll] = await Promise.all([
      supabase.from('profiles').select('id').eq('role', 'SALES_MANAGER'),
      fetchAll<{ day: string; leads: number | null }>((a, b) => supabase
        .from('sales_funnel_days').select('day, leads').gte('day', from).lt('day', to).order('day').order('manager_id').range(a, b)),
      fetchAll<SoldClient>((a, b) => supabase
        .from('clients').select('sold_by_id, purchase_date, payment_amount')
        .not('sold_by_id', 'is', null).gte('purchase_date', from).lt('purchase_date', to).order('id').range(a, b)),
      fetchAll<ReportClient>((a, b) => supabase
        .from('clients').select('id, assigned_to_id, purchase_date, launch_date, payment_amount, status, archived')
        .not('assigned_to_id', 'is', null).order('id').range(a, b)),
      fetchAll<RenewalPayment>((a, b) => supabase
        .from('payments').select('client_id, payment_date, month, amount').eq('is_renewal', true).order('id').range(a, b)),
    ]);
    if (mopsRes.error) throw mopsRes.error;

    const today = new Date(Date.now() + ALMATY_OFFSET_MS).toISOString().slice(0, 10);
    const currentYm = today.slice(0, 7);
    const months = periodMonths('year', year, 1);

    // ОП: only sales managers' sales count, as in the sheet.
    const mops = new Set((mopsRes.data || []).map((p: { id: string }) => p.id));
    const op: Record<string, OpFact> = {};
    for (const ym of months.filter((m) => m <= currentYm)) op[ym] = { leads: 0, sales: 0, revenue: 0 };
    for (const d of days) {
      const f = op[d.day.slice(0, 7)];
      if (f) f.leads += Number(d.leads) || 0;
    }
    for (const c of sold) {
      const f = op[c.purchase_date.slice(0, 7)];
      if (f && mops.has(c.sold_by_id)) {
        f.sales += 1;
        f.revenue += Number(c.payment_amount) || 0;
      }
    }

    // Closed months before the CRM funnel existed: fact from the monthly ОП sheets.
    for (const ym of Object.keys(op)) {
      const sheet = OP_SHEETS_2026[ym];
      if (sheet && ym <= SHEET_FACT_UNTIL) op[ym] = { ...sheet.fact };
    }

    // Targetologists: same attribution and hidden people as «Аналитика таргета».
    const hidden = new Set(HIDDEN_PROFILE_IDS);
    const clients = clientsAll.filter((c) => !hidden.has(c.assigned_to_id as string));
    const ids = new Set(clients.map((c) => c.id));
    const payments = paymentsAll.filter((p) => ids.has(p.client_id));
    const paying = payingByMonth(clients, payments);
    const renewalsBy = new Map<string, number>();
    payments.forEach((p) => p.month && renewalsBy.set(p.month, (renewalsBy.get(p.month) || 0) + 1));
    const funnel = summarize(clients, payments, months, periodBuckets(months), today, 1).weekly;

    const tg: Record<string, TgFact> = {};
    months.forEach((ym, i) => {
      if (ym > currentYm) return;
      const renewals = renewalsBy.get(ym) || 0;
      const prev = paying.get(shiftMonth(ym, -1)) || 0;
      tg[ym] = {
        paying: paying.get(ym) || 0,
        prevPaying: prev,
        newCount: funnel.new[i],
        renewals,
        retention: prev ? renewals / prev : null,
        lost: funnel.lost[i],
      };
    });

    return NextResponse.json({ year, currentYm, months, plan: yearPlan(year, paying), op, tg, sheetFactUntil: SHEET_FACT_UNTIL });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
