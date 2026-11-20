// Sales department (ОП) funnel: the rules of the monthly sheets
// «<Месяц> Resulting ОП <год>», moved into the CRM. Pure functions, shared by
// the API route and the page.

export const FUNNEL_INPUT_FIELDS = [
  'leads', 'qualified', 'rejected', 'callsSet', 'callsDone', 'requisites', 'contracts', 'adBudget',
] as const;
export type FunnelInputField = typeof FUNNEL_INPUT_FIELDS[number];
export type FunnelField = FunnelInputField | 'sales' | 'payment';

export const ADMIN_ONLY_FIELDS: FunnelInputField[] = ['adBudget'];

export interface FunnelRow {
  key: FunnelField;
  label: string;
  source: 'manager' | 'admin' | 'crm';
  money?: boolean;
}

// Same order and wording as the sheets.
export const FUNNEL_ROWS: FunnelRow[] = [
  { key: 'leads', label: 'Кол-во заявок', source: 'manager' },
  { key: 'adBudget', label: 'Рекламный бюджет', source: 'admin', money: true },
  { key: 'qualified', label: 'ЦА заявки', source: 'manager' },
  { key: 'rejected', label: 'Бракованные заявки', source: 'manager' },
  { key: 'callsSet', label: 'Назначен звонок', source: 'manager' },
  { key: 'callsDone', label: 'Успешный звонок', source: 'manager' },
  { key: 'requisites', label: 'Реквизиты', source: 'manager' },
  { key: 'contracts', label: 'Договор', source: 'manager' },
  { key: 'sales', label: 'Кол-во продаж', source: 'crm' },
  { key: 'payment', label: 'Оплата', source: 'crm', money: true },
];

// Plan shares of leads, as in the МОП sheets (B7 = B5*0.4, B9 = B5*25% …).
const PLAN_SHARE: Partial<Record<FunnelField, number>> = {
  qualified: 0.4,
  callsSet: 0.25,
  callsDone: 0.15,
  requisites: 0.15,
  contracts: 0.1,
};

// Pay scheme exactly as the МОП sheets compute it: fixed 100k + 10% of
// payments + 80k bonus from 1.7M of payments. (The sheet formula also lists
// 2.1M → 110k, but its IF order never reaches it; confirmed: keep as sheet.)
// Highest tier reached wins.
export const SALARY_FIX = 100_000;
export const SALARY_PERCENT = 0.1;
export const BONUS_TIERS = [
  { from: 1_700_000, bonus: 80_000 },
];

export type DayValues = Partial<Record<FunnelField, number | null>>;

export interface SalesPlan {
  leadsPlan: number;
  salesPlan: number;
  avgCheck: number;
  adBudgetPlan: number;
}

export interface Week {
  n: number;
  start: string; // YYYY-MM-DD
  end: string;
  days: string[];
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Mon–Sun weeks of a month; an edge week shorter than 2 days joins its neighbour (Nov 2026: 1–8, 9–15, 16–22, 23–30). */
export function monthWeeks(month: string): Week[] {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0));
  const spans: Date[][] = [];
  let start = new Date(Date.UTC(y, m - 1, 1));
  while (start <= last) {
    const toSunday = (7 - start.getUTCDay()) % 7;
    const end = new Date(Math.min(start.getTime() + toSunday * 86_400_000, last.getTime()));
    spans.push([start, end]);
    start = new Date(end.getTime() + 86_400_000);
  }
  const short = (s: Date[]) => s[1].getTime() - s[0].getTime() < 2 * 86_400_000;
  let merged = spans;
  if (merged.length > 1 && short(merged[0])) merged = [[merged[0][0], merged[1][1]], ...merged.slice(2)];
  if (merged.length > 1 && short(merged[merged.length - 1])) {
    merged = [...merged.slice(0, -2), [merged[merged.length - 2][0], merged[merged.length - 1][1]]];
  }
  return merged.map(([s, e], i) => {
    const days: string[] = [];
    for (let d = s.getTime(); d <= e.getTime(); d += 86_400_000) days.push(iso(new Date(d)));
    return { n: i + 1, start: iso(s), end: iso(e), days };
  });
}

export function planFor(plan: SalesPlan | null): Record<FunnelField, number | null> {
  const leads = plan?.leadsPlan ?? 0;
  const out = {} as Record<FunnelField, number | null>;
  for (const row of FUNNEL_ROWS) {
    const share = PLAN_SHARE[row.key];
    out[row.key] = share !== undefined ? Math.round(leads * share) : null;
  }
  out.leads = leads;
  out.rejected = leads - (out.qualified ?? 0);
  out.adBudget = plan?.adBudgetPlan ?? 0;
  out.sales = plan?.salesPlan ?? 0;
  out.payment = (plan?.salesPlan ?? 0) * (plan?.avgCheck ?? 0);
  return out;
}

export function sumDays(days: Record<string, DayValues>, dates: string[], key: FunnelField): number {
  return dates.reduce((acc, d) => acc + (Number(days[d]?.[key]) || 0), 0);
}

export function salesBonus(payment: number): number {
  return BONUS_TIERS.reduce((acc, t) => (payment >= t.from ? t.bonus : acc), 0);
}

export function earnings(payment: number) {
  const percent = Math.round(payment * SALARY_PERCENT);
  const bonus = salesBonus(payment);
  const next = BONUS_TIERS.find((t) => payment < t.from) ?? null;
  return { fix: SALARY_FIX, percent, bonus, total: SALARY_FIX + percent + bonus, next };
}

export function isValidMonth(month: string | null): month is string {
  return !!month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function isValidDay(day: unknown): day is string {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day));
}

export const FIELD_TO_COLUMN: Record<FunnelInputField, string> = {
  leads: 'leads',
  qualified: 'qualified',
  rejected: 'rejected',
  callsSet: 'calls_set',
  callsDone: 'calls_done',
  requisites: 'requisites',
  contracts: 'contracts',
  adBudget: 'ad_budget',
};
