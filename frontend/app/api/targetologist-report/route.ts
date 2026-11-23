import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { fetchAll } from '@/lib/supabase/fetch-all';
import {
  HIDDEN_PROFILE_IDS, Period, RenewalPayment, ReportClient, cohortMonths, cohortTotals, cohorts,
  displayName, periodBuckets, periodMonths, summarize, teamSummary,
} from '@/lib/targetologist-report';

const ALMATY_OFFSET_MS = 5 * 3_600_000;
const PERIODS: Period[] = ['month', 'quarter', 'year'];

/**
 * GET /api/targetologist-report?period=month|quarter|year&year=YYYY&month=M&personId=<id|all>
 * Funnel, ranking and cohorts of targetologists, counted from clients and
 * renewal payments. Clients are attributed to their current targetologist.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRoles('ADMIN');
    const sp = request.nextUrl.searchParams;
    const period = (sp.get('period') || 'month') as Period;
    const year = Number(sp.get('year'));
    const month = Number(sp.get('month') || '1');
    const personId = sp.get('personId') || 'all';
    if (!PERIODS.includes(period) || !Number.isInteger(year) || year < 2020 || year > 2100
      || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ message: 'Некорректный период' }, { status: 400 });
    }

    const supabase = await createClient();
    const [clientsAll, paymentsAll, profilesRes] = await Promise.all([
      fetchAll<ReportClient>((a, b) => supabase
        .from('clients')
        .select('id, assigned_to_id, purchase_date, launch_date, payment_amount, status, archived')
        .not('assigned_to_id', 'is', null)
        .order('id')
        .range(a, b)),
      fetchAll<RenewalPayment>((a, b) => supabase
        .from('payments')
        .select('client_id, payment_date, month, amount')
        .eq('is_renewal', true)
        .order('id')
        .range(a, b)),
      supabase.from('profiles').select('id, full_name'),
    ]);
    if (profilesRes.error) throw profilesRes.error;

    const hidden = new Set(HIDDEN_PROFILE_IDS);
    const clients = clientsAll.filter((c) => c.assigned_to_id && !hidden.has(c.assigned_to_id));
    const ownerOf = new Map(clients.map((c) => [c.id, c.assigned_to_id as string]));
    const payments = paymentsAll.filter((p) => ownerOf.has(p.client_id));

    const today = new Date(Date.now() + ALMATY_OFFSET_MS).toISOString().slice(0, 10);
    const months = periodMonths(period, year, month);
    const buckets = periodBuckets(months);
    const cohortRange = cohortMonths(period, months, today.slice(0, 7));

    // People: anyone with an active client or with sales/renewals in the period.
    const nameOf = new Map((profilesRes.data || []).map((p) => [p.id, displayName(p.full_name)]));
    const byPerson = new Map<string, { clients: ReportClient[]; payments: RenewalPayment[] }>();
    clients.forEach((c) => {
      const cur = byPerson.get(c.assigned_to_id as string) || { clients: [], payments: [] };
      byPerson.set(c.assigned_to_id as string, { ...cur, clients: [...cur.clients, c] });
    });
    payments.forEach((p) => {
      const uid = ownerOf.get(p.client_id) as string;
      const cur = byPerson.get(uid) as { clients: ReportClient[]; payments: RenewalPayment[] };
      byPerson.set(uid, { ...cur, payments: [...cur.payments, p] });
    });

    const people = Array.from(byPerson.entries())
      .filter(([uid]) => nameOf.has(uid))
      .map(([uid, g]) => ({ id: uid, name: nameOf.get(uid) as string, ...summarize(g.clients, g.payments, months, buckets, today, 1) }))
      .filter((p) => p.active > 0 || p.totals.new > 0 || p.totals.renewed > 0 || p.totals.due > 0)
      .sort((a, b) => b.active - a.active || a.name.localeCompare(b.name));

    const selected = personId !== 'all' && byPerson.has(personId) ? personId : 'all';
    const shown = new Set(people.map((p) => p.id));
    const group = selected === 'all'
      ? {
          clients: clients.filter((c) => shown.has(c.assigned_to_id as string)),
          payments: payments.filter((p) => shown.has(ownerOf.get(p.client_id) as string)),
        }
      : (byPerson.get(selected) as { clients: ReportClient[]; payments: RenewalPayment[] });
    const groupPayments = group.payments;

    const cohortRows = cohorts(group.clients, groupPayments, cohortRange, today);

    return NextResponse.json({
      period,
      months,
      today,
      selected,
      buckets,
      summary: selected === 'all'
        ? teamSummary(summarize(group.clients, groupPayments, months, buckets, today, people.length), people)
        : summarize(group.clients, groupPayments, months, buckets, today, 1),
      people: people.map((p) => ({
        id: p.id,
        name: p.name,
        active: p.active,
        inWork: p.activeByStatus.inWork,
        renewal: p.activeByStatus.renewal,
        paused: p.activeByStatus.paused,
        newCount: p.totals.new,
        due: p.totals.due,
        renewed: p.totals.renewed,
        lost: p.totals.lost,
        retDue: p.retDue,
        earnTotal: p.earnTotal,
      })),
      cohorts: cohortRows,
      cohortTotals: cohortTotals(cohortRows),
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
