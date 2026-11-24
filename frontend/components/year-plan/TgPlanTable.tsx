'use client';

import { MonthPlan, PLAN_YEAR, QUARTER_GOALS, TG_NORM } from '@/lib/year-plan';
import { CELL, FACT_BG, HEAD, MonthCell, PLAN_BG, TOTAL_BG, YearPlanData, doneBg, num, pct, ratio } from './shared';

const COLS = [
  'Месяц', 'Таргетологов в штате (план)', `Нужно по норме ${TG_NORM}`, 'ПЛАН: платящих проектов', 'ПЛАН: новых проектов',
  'ПЛАН: продлений', 'ПЛАН: удержание', 'ФАКТ: платящих проектов', 'ФАКТ: новых проектов', 'ФАКТ: продлений',
  'ФАКТ: удержание', 'Не продлили (факт)', 'Выполнение: продления', 'Выполнение: новые', 'Удержание: факт – план',
];

const diff = (v: number | null) => (v === null ? '' : `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`);
const dash = (v: number | null | undefined, f: (n: number) => string = num) => (v === null || v === undefined ? '—' : f(v));
const sum = <T,>(rows: T[], f: (r: T) => number | null) => rows.reduce((a, r) => a + (f(r) ?? 0), 0);
const maxOf = (vals: (number | null)[]) => {
  const xs = vals.filter((v): v is number => v !== null);
  return xs.length ? Math.max(...xs) : null;
};

export default function TgPlanTable({ data }: { data: YearPlanData }) {
  const plans = data.months.map((ym) => data.plan[ym]).filter(Boolean) as MonthPlan[];
  const facts = data.months.map((ym) => data.tg[ym]).filter(Boolean);
  const withRen = plans.filter((p) => p.renewals !== null);
  const factRen = sum(facts, (f) => f.renewals);
  // Completion only over months that have both a plan and a fact.
  const both = data.months.filter((ym) => data.tg[ym] && data.plan[ym]);
  const bothRen = both.filter((ym) => data.plan[ym].renewals !== null);
  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null);

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <table className="min-w-full text-sm border-collapse text-slate-900">
        <thead><tr>{COLS.map((c) => <th key={c} className={`${HEAD} min-w-[84px]`}>{c}</th>)}</tr></thead>
        <tbody>
          {data.months.map((ym) => {
            const p = data.plan[ym];
            const f = data.tg[ym];
            const retDiff = p && p.retention !== null && f && f.retention !== null ? f.retention - p.retention : null;
            const renDone = f && p && p.renewals ? ratio(f.renewals, p.renewals) : null;
            const newDone = f && p && p.sales ? ratio(f.newCount, p.sales) : null;
            return (
              <tr key={ym}>
                <MonthCell ym={ym} currentYm={data.currentYm} />
                <td className={`${CELL} bg-[#fff2cc]`}>{dash(p?.tgStaff)}</td>
                <td className={`${CELL} ${PLAN_BG}`}>{dash(p?.tgNeed)}</td>
                <td className={`${CELL} ${PLAN_BG}`}>{dash(p?.paying)}</td>
                <td className={`${CELL} ${PLAN_BG}`}>{p && p.sales ? num(p.sales) : '—'}</td>
                <td className={`${CELL} ${PLAN_BG} font-bold`}>{dash(p?.renewals)}</td>
                <td className={`${CELL} ${PLAN_BG}`}>{dash(p?.retention, pct)}</td>
                <td className={`${CELL} ${FACT_BG}`}>{f ? num(f.paying) : ''}</td>
                <td className={`${CELL} ${FACT_BG}`}>{f ? num(f.newCount) : ''}</td>
                <td className={`${CELL} ${FACT_BG} font-bold`}>{f ? num(f.renewals) : ''}</td>
                <td className={`${CELL} ${FACT_BG}`}>{f ? pct(f.retention) : ''}</td>
                <td className={`${CELL} ${FACT_BG}`}>{f ? num(f.lost) : ''}</td>
                <td className={`${CELL} font-semibold ${doneBg(renDone)}`}>{pct(renDone)}</td>
                <td className={`${CELL} font-semibold ${doneBg(newDone)}`}>{pct(newDone)}</td>
                <td className={`${CELL} font-semibold ${retDiff === null ? '' : retDiff >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{diff(retDiff)}</td>
              </tr>
            );
          })}
          <tr className={TOTAL_BG}>
            <td className={CELL}>{data.year}</td>
            <td className={CELL}>{dash(maxOf(plans.map((p) => p.tgStaff)))}</td>
            <td className={CELL}>{dash(maxOf(plans.map((p) => p.tgNeed)))}</td>
            <td className={CELL} title="В среднем за месяц">{dash(avg(plans.map((p) => p.paying).filter((v): v is number => v !== null)))}</td>
            <td className={CELL}>{plans.length ? num(sum(plans, (p) => p.sales)) : '—'}</td>
            <td className={CELL}>{withRen.length ? num(sum(withRen, (p) => p.renewals)) : '—'}</td>
            <td className={CELL} title="Среднее по месяцам, как в финмодели">{dash(avg(withRen.map((p) => p.retention as number)), pct)}</td>
            <td className={CELL} title="В среднем за месяц">{dash(avg(facts.map((f) => f.paying)))}</td>
            <td className={CELL}>{num(sum(facts, (f) => f.newCount))}</td>
            <td className={CELL}>{num(factRen)}</td>
            <td className={CELL}>{pct(ratio(factRen, sum(facts, (f) => f.prevPaying)))}</td>
            <td className={CELL}>{num(sum(facts, (f) => f.lost))}</td>
            <td className={CELL}>{pct(ratio(sum(bothRen, (ym) => data.tg[ym].renewals), sum(bothRen, (ym) => data.plan[ym].renewals)))}</td>
            <td className={CELL}>{pct(ratio(sum(both, (ym) => data.tg[ym].newCount), sum(both, (ym) => data.plan[ym].sales)))}</td>
            <td className={CELL} />
          </tr>
        </tbody>
      </table>
      <div className="px-5 py-4">
        {data.year === PLAN_YEAR ? (
          <>
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
          </>
        ) : (
          <p className="text-xs text-slate-500">
            План новых проектов = план продаж ОП из таблиц «Отчет по месяцам». Цель по удержанию (35%) поставлена с ноября 2026 —
            до этого плана по продлениям не было. Продления в CRM вносятся с марта 2026.
          </p>
        )}
      </div>
    </section>
  );
}
