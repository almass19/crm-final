import type { MonthPlan, OpFact, TgFact } from '@/lib/year-plan';
import { monthLabel } from '@/lib/targetologist-report';

export interface YearPlanData {
  year: number;
  currentYm: string;
  months: string[];
  plan: Record<string, MonthPlan>;
  op: Record<string, OpFact>;
  tg: Record<string, TgFact>;
  sheetFactUntil?: string;
}

export const HEAD = 'bg-[#1f3864] text-white text-xs font-bold px-2 py-2 border border-slate-300 text-center align-middle';
export const CELL = 'border border-slate-300 px-2 py-1.5 tabular-nums text-center whitespace-nowrap';
export const PLAN_BG = 'bg-[#dde7f3]';
export const FACT_BG = 'bg-[#e2efda]';
export const TOTAL_BG = 'bg-slate-100 font-bold';

export const num = (v: number | null | undefined): string =>
  v === null || v === undefined ? '' : Math.round(v).toLocaleString('ru-RU');
export const pct = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '' : `${Math.round(v * 100)}%`;
export const ratio = (a: number, b: number): number | null => (b ? a / b : null);

/** Sheet colours: green ≥ 100% of plan, yellow 80–99%, red below. */
export function doneBg(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '';
  if (v >= 1) return 'bg-[#c6efce]';
  if (v >= 0.8) return 'bg-[#ffeb9c]';
  return 'bg-[#ffc7ce]';
}

export function MonthCell({ ym, currentYm }: { ym: string; currentYm: string }) {
  const now = ym === currentYm;
  return (
    <td className={`${CELL} font-bold ${now ? 'bg-[#fce4d6]' : 'bg-white'}`} title={now ? 'Текущий месяц — неполный' : undefined}>
      {monthLabel(ym)}
    </td>
  );
}
