'use client';

import { QUARTER_GOALS, TG_NORM } from '@/lib/year-plan';
import { CELL, FACT_BG, HEAD, MonthCell, PLAN_BG, TOTAL_BG, YearPlanData, doneBg, num, pct, ratio } from './shared';

const COLS = [
  'Месяц', 'Таргетологов в штате (план)', `Нужно по норме ${TG_NORM}`, 'ПЛАН: платящих проектов', 'ПЛАН: новых проектов',
  'ПЛАН: продлений', 'ПЛАН: удержание', 'ФАКТ: платящих проектов', 'ФАКТ: новых проектов', 'ФАКТ: продлений',
  'ФАКТ: удержание', 'Не продлили (факт)', 'Выполнение: продления', 'Выполнение: новые', 'Удержание: факт – план',
];

const diff = (v: number | null) => (v === null ? '' : `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`);

export default function TgPlanTable({ data }: { data: YearPlanData }) {
  const plans = data.months.map((ym) => data.plan[ym]).filter(Boolean);
  const facts = data.months.map((ym) => data.tg[ym]).filter(Boolean);
  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
  const hasPlan = plans.length > 0;
  const planNew = sum(plans, (p) => p.sales);
  const planRen = sum(plans, (p) => p.renewals);
  // Year retention: renewals over everyone who paid the month before (weighted, not an average of %).
  const factRen = sum(facts, (f) => f.renewals);
  const factBase = sum(facts, (f) => f.prevPaying);
  const withBoth = data.months.filter((ym) => data.tg[ym] && data.plan[ym]);
  const planSoFar = (f: (ym: string) => number) => sum(withBoth, f);

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <table className="min-w-full text-sm border-collapse text-slate-900">
        <thead><tr>{COLS.map((c) => <th key={c} className={`${HEAD} min-w-[84px]`}>{c}</th>)}</tr></thead>
        <tbody>
          {data.months.map((ym) => {
            const p = data.plan[ym];
            const f = data.tg[ym];
            const retDiff = p && f && f.retention !== null ? f.retention - p.retention : null;
            return (
              <tr key={ym}>
                <MonthCell ym={ym} currentYm={data.currentYm} />
                <td className={`${CELL} bg-[#fff2cc]`}>{p ? p.tgStaff : '—'}</td>
                <td className={`${CELL} ${PLAN_BG}`}>{p ? p.tgNeed : '—'}</td>
                <td className={`${CELL} ${PLAN_BG}`}>{p ? num(p.paying) : '—'}</td>
                <td className={`${CELL} ${PLAN_BG}`}>{p ? num(p.sales) : '—'}</td>
                <td className={`${CELL} ${PLAN_BG} font-bold`}>{p ? num(p.renewals) : '—'}</td>
                <td className={`${CELL} ${PLAN_BG}`}>{p ? pct(p.retention) : '—'}</td>
                <td className={`${CELL} ${FACT_BG}`}>{f ? num(f.paying) : ''}</td>
                <td className={`${CELL} ${FACT_BG}`}>{f ? num(f.newCount) : ''}</td>
                <td className={`${CELL} ${FACT_BG} font-bold`}>{f ? num(f.renewals) : ''}</td>
                <td className={`${CELL} ${FACT_BG}`}>{f ? pct(f.retention) : ''}</td>
                <td className={`${CELL} ${FACT_BG}`}>{f ? num(f.lost) : ''}</td>
                <td className={`${CELL} font-semibold ${f && p ? doneBg(ratio(f.renewals, p.renewals)) : ''}`}>{f && p ? pct(ratio(f.renewals, p.renewals)) : ''}</td>
                <td className={`${CELL} font-semibold ${f && p ? doneBg(ratio(f.newCount, p.sales)) : ''}`}>{f && p ? pct(ratio(f.newCount, p.sales)) : ''}</td>
                <td className={`${CELL} font-semibold ${retDiff === null ? '' : retDiff >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{diff(retDiff)}</td>
              </tr>
            );
          })}
          <tr className={TOTAL_BG}>
            <td className={CELL}>{data.year}</td>
            <td className={CELL}>{hasPlan ? Math.max(...plans.map((p) => p.tgStaff)) : '—'}</td>
            <td className={CELL}>{hasPlan ? Math.max(...plans.map((p) => p.tgNeed)) : '—'}</td>
            <td className={CELL} title="В среднем за месяц">{hasPlan ? num(sum(plans, (p) => p.paying) / plans.length) : '—'}</td>
            <td className={CELL}>{hasPlan ? num(planNew) : '—'}</td>
            <td className={CELL}>{hasPlan ? num(planRen) : '—'}</td>
            <td className={CELL} title="Среднее по месяцам, как в финмодели">{hasPlan ? pct(sum(plans, (p) => p.retention) / plans.length) : '—'}</td>
            <td className={CELL} title="В среднем за месяц">{facts.length ? num(sum(facts, (f) => f.paying) / facts.length) : ''}</td>
            <td className={CELL}>{num(sum(facts, (f) => f.newCount))}</td>
            <td className={CELL}>{num(factRen)}</td>
            <td className={CELL}>{pct(ratio(factRen, factBase))}</td>
            <td className={CELL}>{num(sum(facts, (f) => f.lost))}</td>
            <td className={CELL}>{pct(ratio(factRen, planSoFar((ym) => data.plan[ym].renewals)))}</td>
            <td className={CELL}>{pct(ratio(sum(facts, (f) => f.newCount), planSoFar((ym) => data.plan[ym].sales)))}</td>
            <td className={CELL} />
          </tr>
        </tbody>
      </table>
      {hasPlan && (
        <div className="px-5 py-4">
          <h3 className="text-sm font-bold text-slate-900 mb-2">Цели по кварталам (из финмодели)</h3>
          <ul className="text-sm text-slate-700 space-y-1">
            {QUARTER_GOALS.map((g) => (
              <li key={g.q} className="flex gap-4">
                <span className="w-10 font-bold">{g.q}</span>
                <span className="w-10 tabular-nums">{pct(g.retention)}</span>
                <span>{g.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
