// Targetologist report («Отчёт таргетологов»): the monthly sheets built by
// resulting-tables/tg_month_data.py, moved into the CRM. Pure functions,
// shared by the API route and the page.
//
// Assumption carried over from the sheets: a payment covers 30 days, so a
// client is due for renewal on pay date + 30. A due date counts as renewed
// if a renewal payment lands between due − 10 and due + 14 days.

import { monthWeeks } from './sales-funnel';

export const PERIOD_DAYS = 30;
const EARLY_DAYS = 10;
const LATE_DAYS = 14;

export const ACTIVE_STATUSES = ['IN_WORK', 'ASSIGNED', 'RENEWAL', 'ONBOARDING', 'SETUP', 'PAUSED', 'NEW'];

// How the active projects split by CRM status; «starting» = not launched yet.
export const ACTIVE_GROUPS = {
  inWork: ['IN_WORK'],
  renewal: ['RENEWAL'],
  paused: ['PAUSED'],
  starting: ['NEW', 'ASSIGNED', 'ONBOARDING', 'SETUP'],
} as const;
export type ActiveGroup = keyof typeof ACTIVE_GROUPS;

export const ACTIVE_NORM = 25; // active projects per targetologist
export const RETENTION_TARGET = 0.35;
export const RATE_NEW = 10_000;
export const RATE_NEW_100_EXTRA = 3_000;
export const RATE_RENEWAL = 14_000;
export const RATE_RENEWAL_100 = 16_000;
const BIG_CHECK = 100_000;

// Not shown in the report at all (their clients are left out of the totals too).
export const HIDDEN_PROFILE_IDS = [
  '7ef61947-8a03-4609-8682-b07b80439e00', // Уристемов Нурсултан
  '099bef1d-3f45-4d6d-a448-b39c34a01139', // Макпозов Темирхан
];

// CRM profile names → how they are shown in the report.
const NAME_FIX: Record<string, string> = {
  'maратов махмет': 'Маратов Махмет',
  'рустем уристемов': 'Уристемов Рустем',
  'rustem yessenberdin': 'Есенбердин Рустем',
  'тусупбаева дильназ нуртлеукызы': 'Тусупбаева Дильназ',
};

export function displayName(fullName: string | null): string {
  const raw = (fullName || '').trim();
  return NAME_FIX[raw.toLowerCase()] || raw || '—';
}

const RU_MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

export type Period = 'month' | 'quarter' | 'year';

export interface ReportClient {
  id: string;
  assigned_to_id: string | null;
  purchase_date: string | null;
  launch_date: string | null;
  payment_amount: number | null;
  status: string | null;
  archived: boolean | null;
}

export interface RenewalPayment {
  client_id: string;
  payment_date: string | null;
  month: string | null;
  amount: number | null;
}

export interface Bucket {
  label: string;
  start: string; // YYYY-MM-DD
  end: string;
}

export const FUNNEL_KEYS = ['new', 'launched', 'due', 'renewed', 'lost', 'waiting'] as const;
export type FunnelKey = typeof FUNNEL_KEYS[number];
export type Weekly = Record<FunnelKey, number[]>;

export interface Summary {
  active: number;
  activeByStatus: Record<ActiveGroup, number>;
  activePlan: number;
  totals: Record<FunnelKey, number>;
  weekly: Weekly;
  renewedPlan: number;
  lostPlan: number;
  prevPaying: number;
  retDue: number | null;
  retPlan: number | null;
  earnNew: number;
  earnRenewal: number;
  earnTotal: number;
  earnPlan: number;
}

export interface Cohort {
  ym: string;
  label: string;
  newCount: number;
  renewed: number;
  third: number;
  active: number;
  pending: number;
  lost: number;
  ret2: number | null;
  ret3: number | null;
}

// ---------- dates ----------

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  return new Date(d.getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

function day10(s: string | null | undefined): string | null {
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthEnd(ym: string): string {
  return addDays(`${shiftMonth(ym, 1)}-01`, -1);
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${RU_MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

/** Months the period covers, in order. `month` is 1–12; for a quarter it's any month inside it. */
export function periodMonths(period: Period, year: number, month: number): string[] {
  const ym = (m: number) => `${year}-${String(m).padStart(2, '0')}`;
  if (period === 'month') return [ym(month)];
  if (period === 'year') return Array.from({ length: 12 }, (_, i) => ym(i + 1));
  const first = Math.floor((month - 1) / 3) * 3 + 1;
  return [ym(first), ym(first + 1), ym(first + 2)];
}

/** Columns of the funnel: weeks for a month, months for a quarter or a year. */
export function periodBuckets(months: string[]): Bucket[] {
  if (months.length === 1) {
    const [, m] = months[0].split('-');
    return monthWeeks(months[0]).map((w) => ({
      label: `Нед ${w.n}\n${Number(w.start.slice(8))}–${Number(w.end.slice(8))}.${m}`,
      start: w.start,
      end: w.end,
    }));
  }
  return months.map((ym) => ({ label: monthLabel(ym), start: `${ym}-01`, end: monthEnd(ym) }));
}

function bucketIndex(buckets: Bucket[], day: string | null): number {
  if (!day) return -1;
  return buckets.findIndex((b) => b.start <= day && day <= b.end);
}

function isActive(c: ReportClient): boolean {
  return ACTIVE_STATUSES.includes(c.status || '') && !c.archived;
}

function renewedAround(due: string, renewals: string[]): boolean {
  const from = addDays(due, -EARLY_DAYS);
  const to = addDays(due, LATE_DAYS);
  return renewals.some((r) => from <= r && r <= to);
}

function renewalDatesByClient(payments: RenewalPayment[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const p of payments) {
    const d = day10(p.payment_date);
    if (!d) continue;
    out.set(p.client_id, [...(out.get(p.client_id) || []), d]);
  }
  out.forEach((list, id) => out.set(id, [...list].sort()));
  return out;
}

// ---------- funnel ----------

function countFunnel(clients: ReportClient[], payments: RenewalPayment[], buckets: Bucket[], today: string): Weekly {
  const weekly = Object.fromEntries(FUNNEL_KEYS.map((k) => [k, buckets.map(() => 0)])) as Weekly;
  const bump = (key: FunnelKey, i: number) => {
    if (i >= 0) weekly[key][i] += 1;
  };
  const renewals = renewalDatesByClient(payments);

  for (const c of clients) {
    const ren = renewals.get(c.id) || [];
    const purchase = day10(c.purchase_date);
    const pays = Array.from(new Set([...(purchase ? [purchase] : []), ...ren])).sort();
    bump('new', bucketIndex(buckets, purchase));
    bump('launched', bucketIndex(buckets, day10(c.launch_date)));
    ren.forEach((r) => bump('renewed', bucketIndex(buckets, r)));
    const active = isActive(c);
    for (const pay of pays) {
      const due = addDays(pay, PERIOD_DAYS);
      const i = bucketIndex(buckets, due);
      if (i < 0) continue;
      bump('due', i);
      if (renewedAround(due, ren)) continue;
      if (!active) bump('lost', i);
      else if (due <= today) bump('waiting', i);
    }
  }
  return weekly;
}

/** New + renewal payments per month — the base the retention plan is measured against. */
export function payingByMonth(clients: ReportClient[], payments: RenewalPayment[]): Map<string, number> {
  const out = new Map<string, number>();
  const add = (ym: string | null | undefined) => {
    if (ym) out.set(ym, (out.get(ym) || 0) + 1);
  };
  clients.forEach((c) => add(day10(c.purchase_date)?.slice(0, 7)));
  payments.forEach((p) => add(p.month));
  return out;
}

function earningsFor(clients: ReportClient[], payments: RenewalPayment[], months: string[]): [number, number] {
  const inRange = (ym: string | null | undefined) => !!ym && months.includes(ym);
  const earnNew = clients
    .filter((c) => inRange(day10(c.purchase_date)?.slice(0, 7)))
    .reduce((s, c) => s + RATE_NEW + ((Number(c.payment_amount) || 0) >= BIG_CHECK ? RATE_NEW_100_EXTRA : 0), 0);
  const earnRenewal = payments
    .filter((p) => inRange(p.month))
    .reduce((s, p) => s + ((Number(p.amount) || 0) >= BIG_CHECK ? RATE_RENEWAL_100 : RATE_RENEWAL), 0);
  return [earnNew, earnRenewal];
}

const ratio = (a: number, b: number): number | null => (b ? a / b : null);

/**
 * Funnel for one group of clients (one targetologist, or the whole team).
 * `payments` must already be narrowed to renewal payments of these clients.
 */
export function summarize(
  clients: ReportClient[],
  payments: RenewalPayment[],
  months: string[],
  buckets: Bucket[],
  today: string,
  people: number,
): Summary {
  const weekly = countFunnel(clients, payments, buckets, today);
  const totals = Object.fromEntries(
    FUNNEL_KEYS.map((k) => [k, weekly[k].reduce((a, b) => a + b, 0)]),
  ) as Record<FunnelKey, number>;

  const paying = payingByMonth(clients, payments);
  const prevPaying = months.reduce((s, ym) => s + (paying.get(shiftMonth(ym, -1)) || 0), 0);
  const renewedPlan = Math.round(prevPaying * RETENTION_TARGET);
  const retPlan = ratio(totals.renewed, prevPaying);
  const [earnNew, earnRenewal] = earningsFor(clients, payments, months);
  const activeClients = clients.filter(isActive);

  return {
    active: activeClients.length,
    activeByStatus: Object.fromEntries(
      (Object.keys(ACTIVE_GROUPS) as ActiveGroup[]).map((g) => [
        g, activeClients.filter((c) => (ACTIVE_GROUPS[g] as readonly string[]).includes(c.status || '')).length,
      ]),
    ) as Record<ActiveGroup, number>,
    activePlan: ACTIVE_NORM * people,
    totals,
    weekly,
    renewedPlan,
    lostPlan: Math.max(0, totals.due - renewedPlan),
    prevPaying,
    retDue: ratio(totals.renewed, totals.due),
    retPlan,
    earnNew,
    earnRenewal,
    earnTotal: earnNew + earnRenewal,
    earnPlan: renewedPlan * RATE_RENEWAL_100 + earnNew,
  };
}

// ---------- cohorts ----------

/** Months shown in «Новые проекты по месяцам»: the last 6 up to the period end, or the year so far. */
export function cohortMonths(period: Period, months: string[], currentYm: string): string[] {
  const last = months[months.length - 1] < currentYm ? months[months.length - 1] : currentYm;
  if (period === 'year') return months.filter((ym) => ym <= last);
  return Array.from({ length: 6 }, (_, i) => shiftMonth(last, i - 5));
}

/** New projects by month of purchase and how many of them were kept (paid a 2nd / 3rd month). */
export function cohorts(
  clients: ReportClient[],
  payments: RenewalPayment[],
  months: string[],
  today: string,
): Cohort[] {
  const renewalCount = new Map<string, number>();
  payments.forEach((p) => renewalCount.set(p.client_id, (renewalCount.get(p.client_id) || 0) + 1));

  return months.map((ym) => {
    const group = clients.filter((c) => c.assigned_to_id && day10(c.purchase_date)?.slice(0, 7) === ym);
    let renewed = 0, third = 0, active = 0, pending = 0, lost = 0;
    let matured30 = 0, kept30 = 0, matured60 = 0, kept60 = 0;
    for (const c of group) {
      const n = renewalCount.get(c.id) || 0;
      const bought = day10(c.purchase_date) as string;
      const live = isActive(c);
      const notDue = addDays(bought, PERIOD_DAYS) > today;
      renewed += n >= 1 ? 1 : 0;
      third += n >= 2 ? 1 : 0;
      active += live ? 1 : 0;
      pending += n === 0 && notDue ? 1 : 0;
      lost += n === 0 && !notDue && !live ? 1 : 0;
      if (!notDue) {
        matured30 += 1;
        kept30 += n >= 1 ? 1 : 0;
      }
      if (addDays(bought, 2 * PERIOD_DAYS) <= today) {
        matured60 += 1;
        kept60 += n >= 2 ? 1 : 0;
      }
    }
    return {
      ym,
      label: monthLabel(ym),
      newCount: group.length,
      renewed,
      third,
      active,
      pending,
      lost,
      ret2: ratio(kept30, matured30),
      ret3: ratio(kept60, matured60),
    };
  });
}

/** Retention over all cohorts, weighted by how many clients could have renewed. */
export function cohortTotals(rows: Cohort[]): Omit<Cohort, 'ym' | 'label'> {
  const sum = (f: (c: Cohort) => number) => rows.reduce((s, c) => s + f(c), 0);
  const weighted = (pairs: [number | null, number][]) => {
    const valid = pairs.filter(([v, w]) => v !== null && w > 0) as [number, number][];
    const total = valid.reduce((s, [, w]) => s + w, 0);
    return total ? valid.reduce((s, [v, w]) => s + v * w, 0) / total : null;
  };
  return {
    newCount: sum((c) => c.newCount),
    renewed: sum((c) => c.renewed),
    third: sum((c) => c.third),
    active: sum((c) => c.active),
    pending: sum((c) => c.pending),
    lost: sum((c) => c.lost),
    ret2: weighted(rows.map((c) => [c.ret2, c.newCount - c.pending])),
    ret3: weighted(rows.filter((c) => c.ret3 !== null).map((c) => [c.ret3, c.newCount])),
  };
}

/**
 * Team view, as in the sheet's «Общая аналитика»: plans are sums of the
 * people (each rounded on its own), not recomputed on the team total.
 */
export function teamSummary(team: Summary, people: Summary[]): Summary {
  const sum = (f: (s: Summary) => number) => people.reduce((a, s) => a + f(s), 0);
  const renewedPlan = sum((s) => s.renewedPlan);
  return {
    ...team,
    renewedPlan,
    lostPlan: Math.max(0, team.totals.due - renewedPlan),
    earnPlan: sum((s) => s.earnPlan),
  };
}
