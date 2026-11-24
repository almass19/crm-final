// Yearly plan of the sales department (ОП) and targetologists: the monthly
// plan recomputed exactly like «Финмодель Resulting 2027» → «Модель 2027»
// (port of resulting-tables/model.py). 2026 comes from the monthly ОП sheets
// (lib/year-plan-2026.ts). Facts come from the CRM in the route.

import { OP_SHEETS_2026 } from './year-plan-2026';

export const PLAN_YEAR = 2027;
export const PLAN_YEARS = [2026, 2027];
export const RETENTION_2026 = 0.35; // target for Nov–Dec 2026, start of the 2027 ladder
const RETENTION_2026_FROM = '2026-11';

const MOP = [5, 5, 5, 6, 6, 6, 6, 6, 6, 7, 7, 7];
const LEADS_PER_MOP = 220;
const CONV = 0.1;
const SEASON = [1, 0.85, 0.65, 1, 0.8, 0.85, 0.75, 0.7, 1.05, 1, 1, 0.9];
const RETENTION = [0.35, 0.35, 0.35, 0.42, 0.42, 0.42, 0.48, 0.48, 0.48, 0.52, 0.52, 0.52];
const CHECK = [86_000, 86_000, 86_000, 88_000, 88_000, 88_000, 90_000, 90_000, 90_000, 92_000, 92_000, 92_000];
const CPL = [2500, 2500, 2500, 2500, 2500, 2500, 2600, 2600, 2600, 3000, 3000, 3000];
const START_PAYING = 115; // paying clients in Dec 2026
export const TG_NORM = 25;
const CURRENT_TG_STAFF = 8;

export const QUARTER_GOALS = [
  { q: '1 кв', retention: 0.35, note: 'PM с января, выровнять нагрузку до 25, разобрать нулевые продления' },
  { q: '2 кв', retention: 0.42, note: 'с апреля все продления по 100 000 ₸' },
  { q: '3 кв', retention: 0.48, note: 'пройти лето без провала, акция для старой базы' },
  { q: '4 кв', retention: 0.52, note: '≈ 150 продлений в месяц к декабрю' },
];

export interface MonthPlan {
  mops: number;
  leads: number;
  sales: number;
  conv: number;
  check: number;
  revenue: number;
  adBudget: number;
  // Targetologist plan; null where the source has none (2026 before November).
  tgStaff: number | null;
  tgNeed: number | null;
  paying: number | null;
  prevPaying: number | null;
  renewals: number | null;
  retention: number | null;
}

/** Excel ROUND for non-negative numbers (half away from zero). */
const excelRound = (x: number) => Math.floor(x + 0.5);

/**
 * 2026: ОП plan from the monthly sheets. New projects for targetologists =
 * ОП sales plan; renewals are planned only from November (35% of everyone who
 * paid the month before — `paying` is the CRM fact, so the route passes it).
 */
function plan2026(paying: Map<string, number>): Record<string, MonthPlan> {
  const out: Record<string, MonthPlan> = {};
  for (let m = 1; m <= 12; m++) {
    const ym = `2026-${String(m).padStart(2, '0')}`;
    const sheet = OP_SHEETS_2026[ym];
    const prevYm = `2026-${String(m - 1).padStart(2, '0')}`;
    const withRetention = ym >= RETENTION_2026_FROM;
    if (!sheet && !withRetention) continue;
    const prevPaying = withRetention ? paying.get(prevYm) ?? 0 : null;
    const renewals = prevPaying !== null ? excelRound(prevPaying * RETENTION_2026) : null;
    const sales = sheet?.sales ?? 0;
    out[ym] = {
      mops: sheet?.mops ?? 0,
      leads: sheet?.leads ?? 0,
      sales,
      conv: sheet && sheet.leads ? sheet.sales / sheet.leads : 0,
      check: sheet && sheet.sales ? Math.round(sheet.revenue / sheet.sales) : 0,
      revenue: sheet?.revenue ?? 0,
      adBudget: sheet?.adBudget ?? 0,
      tgStaff: null,
      // Paying projects need the ОП sales plan too — no sheet (December) means no total.
      tgNeed: renewals !== null && sheet ? Math.ceil((sales + renewals) / TG_NORM) : null,
      paying: renewals !== null && sheet ? sales + renewals : null,
      prevPaying,
      renewals,
      retention: withRetention ? RETENTION_2026 : null,
    };
  }
  return out;
}

/** Plan per month, keyed YYYY-MM. `paying` (CRM fact by month) is needed for 2026 only. */
export function yearPlan(year: number, paying: Map<string, number> = new Map()): Record<string, MonthPlan> {
  if (year === 2026) return plan2026(paying);
  if (year !== PLAN_YEAR) return {};
  const out: Record<string, MonthPlan> = {};
  let prev = START_PAYING;
  for (let i = 0; i < 12; i++) {
    const leads = excelRound(MOP[i] * LEADS_PER_MOP * SEASON[i]);
    const sales = excelRound(leads * CONV);
    const renewals = excelRound(prev * RETENTION[i]);
    const paying = sales + renewals;
    const need = Math.ceil(paying / TG_NORM);
    out[`${year}-${String(i + 1).padStart(2, '0')}`] = {
      mops: MOP[i],
      leads,
      sales,
      conv: CONV,
      check: CHECK[i],
      revenue: sales * CHECK[i],
      adBudget: leads * CPL[i],
      tgStaff: Math.max(CURRENT_TG_STAFF, need),
      tgNeed: need,
      paying,
      prevPaying: prev,
      renewals,
      retention: RETENTION[i],
    };
    prev = paying;
  }
  return out;
}

export interface OpFact {
  leads: number;
  sales: number;
  revenue: number;
}

export interface TgFact {
  paying: number;
  prevPaying: number;
  newCount: number;
  renewals: number;
  retention: number | null;
  lost: number;
}
