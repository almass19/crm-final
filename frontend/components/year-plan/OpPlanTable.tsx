'use client';

import { useMoney } from '@/lib/privacy';
import { PLAN_YEAR } from '@/lib/year-plan';
import PairTable from './PairTable';
import { YearPlanData, num, pct, ratio } from './shared';

export default function OpPlanTable({ data }: { data: YearPlanData }) {
  const money = useMoney();
  const m = (v: number) => money(Math.round(v));
  // 2026 December has only a targetologist plan — no ОП sheet.
  const opPlan = (ym: string) => (data.plan[ym]?.sales ? data.plan[ym] : undefined);
  const plans = data.months.map(opPlan).filter((p): p is NonNullable<typeof p> => !!p);
  const facts = data.months.map((ym) => data.op[ym]).filter(Boolean);
  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
  const hasPlan = plans.length > 0;
  const P = {
    leads: sum(plans, (p) => p.leads), sales: sum(plans, (p) => p.sales),
    revenue: sum(plans, (p) => p.revenue), ad: sum(plans, (p) => p.adBudget),
  };
  const F = { leads: sum(facts, (f) => f.leads), sales: sum(facts, (f) => f.sales), revenue: sum(facts, (f) => f.revenue) };
  // Year completion only over months that already have a fact.
  const doneSoFar = (fact: number, f: (p: (typeof plans)[number]) => number) => {
    const planned = data.months.map((ym) => (data.op[ym] ? opPlan(ym) : undefined)).filter((p): p is NonNullable<typeof p> => !!p);
    return ratio(fact, sum(planned, f));
  };
  const orNull = (v: number) => (hasPlan ? v : null);
  const fromSheet = (ym: string) => !!data.sheetFactUntil && ym.startsWith('2026') && ym <= data.sheetFactUntil;

  return (
    <div className="space-y-3">
      <PairTable
        data={data}
        before={[{ label: 'МОПов (план)', value: (ym) => opPlan(ym)?.mops, total: hasPlan ? Math.max(...plans.map((p) => p.mops)) : null, fmt: num, kind: 'input' }]}
        pairs={[
          {
            label: 'Заявки', plan: (ym) => opPlan(ym)?.leads, fact: (ym) => data.op[ym]?.leads,
            planTotal: orNull(P.leads), factTotal: F.leads, fmt: num, graded: true, doneTotal: doneSoFar(F.leads, (p) => p.leads),
            factTitle: (ym) => (data.op[ym] ? (fromSheet(ym) ? 'Из таблицы «Отчет по месяцам»' : 'Из CRM («Воронка ОП»)') : undefined),
          },
          {
            label: 'Продажи', plan: (ym) => opPlan(ym)?.sales, fact: (ym) => data.op[ym]?.sales,
            planTotal: orNull(P.sales), factTotal: F.sales, fmt: num, graded: true, bold: true, doneTotal: doneSoFar(F.sales, (p) => p.sales),
          },
          {
            label: 'Конверсия', plan: (ym) => opPlan(ym)?.conv,
            fact: (ym) => (data.op[ym] ? ratio(data.op[ym].sales, data.op[ym].leads) : null),
            planTotal: hasPlan ? ratio(P.sales, P.leads) : null, factTotal: ratio(F.sales, F.leads), fmt: pct,
          },
          {
            label: 'Средний чек', plan: (ym) => opPlan(ym)?.check,
            fact: (ym) => (data.op[ym]?.sales ? data.op[ym].revenue / data.op[ym].sales : null),
            planTotal: hasPlan ? P.revenue / P.sales : null, factTotal: F.sales ? F.revenue / F.sales : null, fmt: m,
          },
          {
            label: 'Выручка', plan: (ym) => opPlan(ym)?.revenue, fact: (ym) => data.op[ym]?.revenue,
            planTotal: orNull(P.revenue), factTotal: F.revenue, fmt: m, graded: true, bold: true, doneTotal: doneSoFar(F.revenue, (p) => p.revenue),
          },
        ]}
        after={[{ label: 'Реклама ОП (план)', value: (ym) => opPlan(ym)?.adBudget, total: orNull(P.ad), fmt: m, kind: 'plan' }]}
      />
      <div className="px-1 text-sm text-slate-600 space-y-1">
        <p className="text-xs text-slate-500">
          Цвет факта — выполнение плана: зелёный ≥ 100%, жёлтый 80–99%, красный ниже. Итог года сравнивается с планом только прошедших месяцев.
        </p>
        {hasPlan && (
          <p><b>Контроль:</b> реклама на одну продажу (план) — {m(P.ad / P.sales)}; продаж на МОПа в среднем (план) — {(P.sales / sum(plans, (p) => p.mops)).toFixed(1)} в месяц.</p>
        )}
        {data.year === PLAN_YEAR && (
          <p className="text-xs text-slate-500">Найм: 6-й МОП в январе (продаёт с апреля), 7-й — в августе под сентябрь. Летом отдел не сокращать.</p>
        )}
        <p className="text-xs text-slate-500">
          {data.year === 2026
            ? '2026: план и факт по январь–октябрь — из таблиц «Отчет по месяцам» (сумма листов МОПов). С ноября факт — из CRM: заявки из «Воронки ОП», продажи и выручка из карточек клиентов менеджеров по продажам.'
            : 'Факт: заявки — из «Воронки ОП», продажи и выручка — из карточек клиентов, только у менеджеров по продажам (продажи таргетологов и админов не попадают).'}
        </p>
      </div>
    </div>
  );
}
