// Yearly plan of the sales department (ОП) and targetologists: the monthly
// plan recomputed exactly like «Финмодель Resulting 2027» → «Модель 2027»
// (port of resulting-tables/model.py). Facts come from the CRM in the route.

export const PLAN_YEAR = 2027;

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
  tgStaff: number;
  tgNeed: number;
  paying: number;
  prevPaying: number;
  renewals: number;
  retention: number;
}

/** Excel ROUND for non-negative numbers (half away from zero). */
const excelRound = (x: number) => Math.floor(x + 0.5);

/** Plan per month of PLAN_YEAR, keyed YYYY-MM. Other years have no plan. */
export function yearPlan(year: number): Record<string, MonthPlan> {
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
