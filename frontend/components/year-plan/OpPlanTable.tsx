'use client';

import { useMoney } from '@/lib/privacy';
import { CELL, FACT_BG, HEAD, MonthCell, PLAN_BG, TOTAL_BG, YearPlanData, doneBg, num, pct, ratio } from './shared';

const COLS = [
  'Месяц', 'МОПов (план)', 'ПЛАН: заявок', 'ПЛАН: продаж', 'ПЛАН: конверсия', 'ПЛАН: средний чек', 'ПЛАН: выручка',
  'ПЛАН: реклама ОП', 'ФАКТ: заявок', 'ФАКТ: продаж', 'ФАКТ: конверсия', 'ФАКТ: средний чек', 'ФАКТ: выручка',
  'Выполнение: продажи', 'Выполнение: выручка',
];

export default function OpPlanTable({ data }: { data: YearPlanData }) {
  const money = useMoney();
  const m = (v: number | null | undefined) => (v === null || v === undefined ? '' : money(Math.round(v)));
  const plans = data.months.map((ym) => data.plan[ym]).filter(Boolean);
  const facts = data.months.map((ym) => data.op[ym]).filter(Boolean);
  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
  const P = {
    leads: sum(plans, (p) => p.leads), sales: sum(plans, (p) => p.sales),
    revenue: sum(plans, (p) => p.revenue), ad: sum(plans, (p) => p.adBudget),
  };
  const F = { leads: sum(facts, (f) => f.leads), sales: sum(facts, (f) => f.sales), revenue: sum(facts, (f) => f.revenue) };
  // Completion of the year only over months that already have a fact.
  const planSoFar = (f: (p: (typeof plans)[number]) => number) =>
    sum(data.months.filter((ym) => data.op[ym] && data.plan[ym]).map((ym) => data.plan[ym]), f);
  const hasPlan = plans.length > 0;

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <table className="min-w-full text-sm border-collapse text-slate-900">
        <thead><tr>{COLS.map((c) => <th key={c} className={`${HEAD} min-w-[84px]`}>{c}</th>)}</tr></thead>
        <tbody>
          {data.months.map((ym) => {
            const p = data.plan[ym];
            const f = data.op[ym];
            return (
              <tr key={ym}>
                <MonthCell ym={ym} currentYm={data.currentYm} />
                <td className={`${CELL} bg-[#fff2cc]`}>{p ? p.mops : '—'}</td>
                <td className={`${CELL} ${PLAN_BG}`}>{p ? num(p.leads) : '—'}</td>
                <td className={`${CELL} ${PLAN_BG} font-bold`}>{p ? num(p.sales) : '—'}</td>
                <td className={`${CELL} ${PLAN_BG}`}>{p ? pct(p.conv) : '—'}</td>
                <td className={`${CELL} ${PLAN_BG}`}>{p ? m(p.check) : '—'}</td>
                <td className={`${CELL} ${PLAN_BG} font-bold`}>{p ? m(p.revenue) : '—'}</td>
                <td className={`${CELL} ${PLAN_BG}`}>{p ? m(p.adBudget) : '—'}</td>
                <td className={`${CELL} ${FACT_BG}`}>{f ? num(f.leads) : ''}</td>
                <td className={`${CELL} ${FACT_BG} font-bold`}>{f ? num(f.sales) : ''}</td>
                <td className={`${CELL} ${FACT_BG}`}>{f ? pct(ratio(f.sales, f.leads)) : ''}</td>
                <td className={`${CELL} ${FACT_BG}`}>{f && f.sales ? m(f.revenue / f.sales) : ''}</td>
                <td className={`${CELL} ${FACT_BG} font-bold`}>{f ? m(f.revenue) : ''}</td>
                <td className={`${CELL} font-semibold ${f && p ? doneBg(ratio(f.sales, p.sales)) : ''}`}>{f && p ? pct(ratio(f.sales, p.sales)) : ''}</td>
                <td className={`${CELL} font-semibold ${f && p ? doneBg(ratio(f.revenue, p.revenue)) : ''}`}>{f && p ? pct(ratio(f.revenue, p.revenue)) : ''}</td>
              </tr>
            );
          })}
          <tr className={TOTAL_BG}>
            <td className={CELL}>{data.year}</td>
            <td className={CELL}>{hasPlan ? Math.max(...plans.map((p) => p.mops)) : '—'}</td>
            <td className={CELL}>{hasPlan ? num(P.leads) : '—'}</td>
            <td className={CELL}>{hasPlan ? num(P.sales) : '—'}</td>
            <td className={CELL}>{hasPlan ? pct(ratio(P.sales, P.leads)) : '—'}</td>
            <td className={CELL}>{hasPlan ? m(P.revenue / P.sales) : '—'}</td>
            <td className={CELL}>{hasPlan ? m(P.revenue) : '—'}</td>
            <td className={CELL}>{hasPlan ? m(P.ad) : '—'}</td>
            <td className={CELL}>{num(F.leads)}</td>
            <td className={CELL}>{num(F.sales)}</td>
            <td className={CELL}>{pct(ratio(F.sales, F.leads))}</td>
            <td className={CELL}>{F.sales ? m(F.revenue / F.sales) : ''}</td>
            <td className={CELL}>{m(F.revenue)}</td>
            <td className={`${CELL} ${doneBg(ratio(F.sales, planSoFar((p) => p.sales)))}`}>{pct(ratio(F.sales, planSoFar((p) => p.sales)))}</td>
            <td className={`${CELL} ${doneBg(ratio(F.revenue, planSoFar((p) => p.revenue)))}`}>{pct(ratio(F.revenue, planSoFar((p) => p.revenue)))}</td>
          </tr>
        </tbody>
      </table>
      {hasPlan && (
        <div className="px-5 py-4 text-sm text-slate-600 space-y-1">
          <p><b>Контроль:</b> реклама на одну продажу (план) — {m(P.ad / P.sales)}; продаж на МОПа в среднем (план) — {(P.sales / (plans.reduce((a, p) => a + p.mops, 0))).toFixed(1)} в месяц.</p>
          <p className="text-xs text-slate-500">Найм: 6-й МОП в январе (продаёт с апреля), 7-й — в августе под сентябрь. Летом отдел не сокращать.</p>
          <p className="text-xs text-slate-500">Факт: заявки — из «Воронки ОП», продажи и выручка — из карточек клиентов, только у менеджеров по продажам (продажи таргетологов и админов не попадают).</p>
        </div>
      )}
    </section>
  );
}
