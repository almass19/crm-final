'use client';

import { planFor, sumDays } from '@/lib/sales-funnel';
import { FunnelData, fmtMoney, fmtPct } from './types';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="text-2xl font-black tracking-tight text-slate-900 mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

/** Plan vs fact, pace to the end of the month and (for one manager) earnings. */
export default function Summary({ data }: { data: FunnelData }) {
  const plan = planFor(data.plan);
  const allDays = data.weeks.flatMap((w) => w.days);
  const sales = sumDays(data.days, allDays, 'sales');
  const payment = sumDays(data.days, allDays, 'payment');
  const salesPlan = plan.sales ?? 0;
  const daysLeft = allDays.filter((d) => d > data.today).length;
  const passed = allDays.length - daysLeft;
  const forecast = passed > 0 ? Math.round((sales / passed) * allDays.length) : 0;
  const need = Math.max(salesPlan - sales, 0);
  const e = data.earnings;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Stat
        label="Продажи / план"
        value={`${sales} / ${salesPlan}`}
        hint={`выполнено ${fmtPct(salesPlan ? sales / salesPlan : null)}`}
      />
      <Stat label="Оплата" value={fmtMoney(payment)} hint={`план ${fmtMoney(plan.payment ?? 0)}`} />
      <Stat
        label="Прогноз на месяц"
        value={`${forecast} продаж`}
        hint={need && daysLeft ? `нужно ${(need / daysLeft).toFixed(1)} в день до конца месяца` : need ? `не хватило ${need}` : 'план выполнен'}
      />
      {e ? (
        <Stat
          label="Я заработаю"
          value={fmtMoney(e.total)}
          hint={`фикс ${fmtMoney(e.fix)} + 10% ${fmtMoney(e.percent)} + бонус ${fmtMoney(e.bonus)}${
            e.next ? ` · до бонуса ${fmtMoney(e.next.bonus)} ещё ${fmtMoney(e.next.from - payment)} оплат` : ''
          }`}
        />
      ) : (
        <Stat label="Средний чек" value={sales ? fmtMoney(payment / sales) : '—'} />
      )}
    </div>
  );
}
