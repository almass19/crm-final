'use client';

import { MonthPlan, PLAN_YEAR, QUARTER_GOALS, TG_NORM } from '@/lib/year-plan';
import PairTable from './PairTable';
import { YearPlanData, num, pct, ratio } from './shared';

const sum = <T,>(rows: T[], f: (r: T) => number | null) => rows.reduce((a, r) => a + (f(r) ?? 0), 0);
const avg = (vals: (number | null)[]) => {
  const xs = vals.filter((v): v is number => v !== null);
  return xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : null;
};
const maxOf = (vals: (number | null)[]) => {
  const xs = vals.filter((v): v is number => v !== null);
  return xs.length ? Math.max(...xs) : null;
};

export default function TgPlanTable({ data }: { data: YearPlanData }) {
  const plan = (ym: string): MonthPlan | undefined => data.plan[ym];
  const plans = data.months.map(plan).filter((p): p is MonthPlan => !!p);
  const facts = data.months.map((ym) => data.tg[ym]).filter(Boolean);
  const factRen = sum(facts, (f) => f.renewals);
  const factNew = sum(facts, (f) => f.newCount);
  // Year completion only over months that have both a plan and a fact.
  const both = data.months.filter((ym) => data.tg[ym] && data.plan[ym]);
  const bothRen = both.filter((ym) => data.plan[ym].renewals !== null);
  const withRen = plans.filter((p) => p.renewals !== null);
  const bothPaying = both.filter((ym) => data.plan[ym].paying !== null);

  return (
    <div className="space-y-3">
      <PairTable
        data={data}
        before={[
          { label: 'Таргетологов в штате (план)', value: (ym) => plan(ym)?.tgStaff, total: maxOf(plans.map((p) => p.tgStaff)), fmt: num, kind: 'input' },
          { label: `Нужно по норме ${TG_NORM}`, value: (ym) => plan(ym)?.tgNeed, total: maxOf(plans.map((p) => p.tgNeed)), fmt: num, kind: 'plan' },
        ]}
        pairs={[
          {
            label: 'Платящих проектов', plan: (ym) => plan(ym)?.paying, fact: (ym) => data.tg[ym]?.paying,
            planTotal: avg(plans.map((p) => p.paying)), factTotal: avg(facts.map((f) => f.paying)), fmt: num, graded: true,
            doneTotal: ratio(sum(bothPaying, (ym) => data.tg[ym].paying), sum(bothPaying, (ym) => data.plan[ym].paying)),
          },
          {
            label: 'Новых проектов', plan: (ym) => plan(ym)?.sales || null, fact: (ym) => data.tg[ym]?.newCount,
            planTotal: plans.length ? sum(plans, (p) => p.sales) : null, factTotal: factNew, fmt: num, graded: true,
            doneTotal: ratio(sum(both, (ym) => data.tg[ym].newCount), sum(both, (ym) => data.plan[ym].sales)),
          },
          {
            label: 'Продлений', plan: (ym) => plan(ym)?.renewals, fact: (ym) => data.tg[ym]?.renewals,
            planTotal: withRen.length ? sum(withRen, (p) => p.renewals) : null, factTotal: factRen, fmt: num, graded: true, bold: true,
            doneTotal: ratio(sum(bothRen, (ym) => data.tg[ym].renewals), sum(bothRen, (ym) => data.plan[ym].renewals)),
          },
          {
            label: 'Удержание', plan: (ym) => plan(ym)?.retention, fact: (ym) => data.tg[ym]?.retention,
            planTotal: avg(withRen.map((p) => p.retention)), factTotal: ratio(factRen, sum(facts, (f) => f.prevPaying)), fmt: pct, graded: true,
            doneTotal: ratio(
              ratio(sum(bothRen, (ym) => data.tg[ym].renewals), sum(bothRen, (ym) => data.tg[ym].prevPaying)) ?? 0,
              avg(bothRen.map((ym) => data.plan[ym].retention)) ?? 0,
            ),
          },
        ]}
        after={[{ label: 'Не продлили (факт)', value: (ym) => data.tg[ym]?.lost, total: sum(facts, (f) => f.lost), fmt: num, kind: 'fact' }]}
      />
      <div className="px-1 space-y-2">
        <p className="text-xs text-slate-500">
          Цвет факта — выполнение плана: зелёный ≥ 100%, жёлтый 80–99%, красный ниже. «Платящих» и «удержание» в итоге года — в среднем за месяц.
        </p>
        {data.year === PLAN_YEAR ? (
          <div>
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
        ) : (
          <p className="text-xs text-slate-500">
            План новых проектов = план продаж ОП из таблиц «Отчет по месяцам». Цель по удержанию (35%) поставлена с ноября 2026 —
            до этого плана по продлениям не было. Продления в CRM вносятся с марта 2026.
          </p>
        )}
      </div>
    </div>
  );
}
