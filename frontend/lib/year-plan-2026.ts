// 2026 plan and fact of the sales department, from the monthly ОП sheets in
// the Drive folder «Отчет по месяцам» («<Месяц> Resulting ОП 2026», one sheet
// per МОП; plan and fact summed over the МОП sheets). Static: these months
// are closed. From November the fact is counted in the CRM («Воронка ОП»).

export interface SheetMonth {
  mops: number;
  leads: number;
  sales: number;
  revenue: number;
  adBudget: number;
  fact: { leads: number; sales: number; revenue: number };
}

/** Last month whose fact is taken from the sheets; later months come from the CRM. */
export const SHEET_FACT_UNTIL = '2026-10';

export const OP_SHEETS_2026: Record<string, SheetMonth> = {
  '2026-01': { mops: 4, leads: 1800, sales: 180, revenue: 14400000, adBudget: 1908000, fact: { leads: 650, sales: 64, revenue: 6709700 } },
  '2026-02': { mops: 7, leads: 3150, sales: 370, revenue: 23499000, adBudget: 3339000, fact: { leads: 747, sales: 77, revenue: 5826460 } },
  '2026-03': { mops: 7, leads: 3150, sales: 370, revenue: 23499000, adBudget: 3339000, fact: { leads: 509, sales: 38, revenue: 3657030 } },
  '2026-04': { mops: 7, leads: 3150, sales: 370, revenue: 23499000, adBudget: 3339000, fact: { leads: 529, sales: 69, revenue: 5938720 } },
  '2026-05': { mops: 4, leads: 1800, sales: 180, revenue: 14400000, adBudget: 1908000, fact: { leads: 529, sales: 44, revenue: 3550000 } },
  '2026-06': { mops: 4, leads: 1800, sales: 180, revenue: 14400000, adBudget: 1908000, fact: { leads: 529, sales: 52, revenue: 4345000 } },
  '2026-07': { mops: 4, leads: 680, sales: 180, revenue: 14400000, adBudget: 1908000, fact: { leads: 529, sales: 38, revenue: 3125000 } },
  '2026-08': { mops: 3, leads: 510, sales: 135, revenue: 10800000, adBudget: 1431000, fact: { leads: 483, sales: 14, revenue: 1330000 } },
  '2026-09': { mops: 5, leads: 850, sales: 225, revenue: 18000000, adBudget: 2385000, fact: { leads: 853, sales: 62, revenue: 5523000 } },
  '2026-10': { mops: 3, leads: 510, sales: 135, revenue: 10800000, adBudget: 1431000, fact: { leads: 494, sales: 50, revenue: 4738000 } },
  '2026-11': { mops: 5, leads: 1350, sales: 135, revenue: 10800000, adBudget: 5962500, fact: { leads: 676, sales: 60, revenue: 4860000 } },
};
