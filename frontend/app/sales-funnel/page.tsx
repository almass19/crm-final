'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';
import FunnelGrid from '@/components/sales-funnel/FunnelGrid';
import DayForm from '@/components/sales-funnel/DayForm';
import Summary from '@/components/sales-funnel/Summary';
import PlanModal from '@/components/sales-funnel/PlanModal';
import { FunnelData, ManagerPlan, fmtPct } from '@/components/sales-funnel/types';
import { useMoney, usePrivacy } from '@/lib/privacy';
import { FunnelField, FunnelRow } from '@/lib/sales-funnel';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const ALLOWED = ['ADMIN', 'SALES_MANAGER'];

export default function SalesFunnelPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const fmtMoney = useMoney();
  const { hideMoney } = usePrivacy();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [managerId, setManagerId] = useState('all');
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planOpen, setPlanOpen] = useState(false);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const load = useCallback(async () => {
    if (!user || !ALLOWED.includes(user.role || '')) return;
    setLoading(true);
    setError('');
    try {
      setData(await api.getSalesFunnel(monthStr, user.role === 'ADMIN' ? managerId : undefined));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [user, monthStr, managerId]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    else if (user && !ALLOWED.includes(user.role || '')) router.replace('/clients');
    else load();
  }, [authLoading, user, router, load]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background-light text-slate-500">Загрузка...</div>;
  }
  if (!ALLOWED.includes(user.role || '')) {
    return <div className="min-h-screen flex items-center justify-center bg-background-light text-red-500">Доступ запрещён</div>;
  }

  const isAdmin = user.role === 'ADMIN';
  const single = data ? data.selected !== 'all' : false;

  const canEdit = (row: FunnelRow, day: string): boolean => {
    if (!data || !single || row.source === 'crm' || day > data.today) return false;
    if (row.source === 'admin') return isAdmin;
    return isAdmin || data.selected === user.id;
  };

  const saveCell = async (field: FunnelField, day: string, value: number | null) => {
    if (!data) return;
    const prev = data.days;
    const prevUsd = data.adUsd;
    // The ad budget is typed in USD; the server converts it and returns the KZT amount.
    const isUsd = field === 'adBudget';
    if (!isUsd) setData({ ...data, days: { ...prev, [day]: { ...(prev[day] || {}), [field]: value } } });
    try {
      const res = await api.saveSalesFunnelCell({ managerId: data.selected, day, field, value });
      if (isUsd) {
        setData((d) => {
          if (!d) return d;
          const restUsd = Object.fromEntries(Object.entries(d.adUsd).filter(([k]) => k !== day));
          return {
            ...d,
            days: { ...d.days, [day]: { ...(d.days[day] || {}), adBudget: res.adBudget ?? null } },
            adUsd: res.adBudgetUsd == null ? restUsd : { ...restUsd, [day]: { usd: res.adBudgetUsd, rate: res.usdRate ?? null } },
          };
        });
      }
    } catch (err: unknown) {
      setData((d) => (d ? { ...d, days: prev, adUsd: prevUsd } : d));
      showToast(err instanceof Error ? err.message : 'Не удалось сохранить', 'error');
      throw err;
    }
  };

  const savePlan = async (plan: ManagerPlan) => {
    await api.saveSalesPlan({ month: monthStr, ...plan });
  };

  return (
    <AppShell>
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 md:px-8 py-3 md:py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600" aria-label="Предыдущий месяц">‹</button>
          <span className="text-sm font-semibold text-slate-900 min-w-[150px] text-center">{MONTH_NAMES[month - 1]} {year}</span>
          <button onClick={() => shiftMonth(1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600" aria-label="Следующий месяц">›</button>
        </div>
        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {isAdmin && data && (
            <>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-slate-700"
              >
                <option value="all">Весь отдел</option>
                {data.managers.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
              </select>
              <button
                onClick={() => setPlanOpen(true)}
                className="px-3 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
              >
                План месяца
              </button>
            </>
          )}
          <NotificationBell />
        </div>
      </div>

      <div className="p-4 sm:p-6 md:p-8 space-y-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Воронка ОП</h1>
          <p className="text-slate-500 mt-1">
            {single ? 'Жёлтые ячейки заполняются вручную. Заявки и рекламный бюджет (в $, по курсу Нацбанка) — только руководитель. Продажи и оплата — из карточек клиентов.' : 'Сумма по всему отделу. Выберите менеджера, чтобы заполнять его воронку.'}
          </p>
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

        {loading && !data ? (
          <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />
        ) : data && (
          <>
            {!data.plan && (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm">
                План на этот месяц ещё не поставлен{isAdmin ? ' — нажмите «План месяца».' : '. Обратитесь к руководителю.'}
              </div>
            )}
            <Summary data={data} />
            {single && <DayForm data={data} canEdit={canEdit} onSave={saveCell} />}
            <FunnelGrid data={data} hideMoney={hideMoney} canEdit={canEdit} onSave={(f, d, v) => { saveCell(f, d, v).catch(() => {}); }} />

            {isAdmin && !single && data.managers.length > 0 && (
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                <h2 className="px-5 pt-4 text-base font-bold text-slate-900">Рейтинг менеджеров</h2>
                <table className="min-w-full text-sm mt-2">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>{['Менеджер', 'Продажи', 'План', 'Выполнение', 'Оплата'].map((h) => <th key={h} className="px-5 py-2 text-left font-bold">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.managers.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setManagerId(m.id)}>
                        <td className="px-5 py-2 font-medium">{m.fullName}</td>
                        <td className="px-5 py-2 tabular-nums">{m.sales}</td>
                        <td className="px-5 py-2 tabular-nums text-slate-500">{m.salesPlan || '—'}</td>
                        <td className="px-5 py-2 tabular-nums">{fmtPct(m.salesPlan ? m.sales / m.salesPlan : null)}</td>
                        <td className="px-5 py-2 tabular-nums">{fmtMoney(m.payment)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
              <h2 className="px-5 pt-4 text-base font-bold text-slate-900">Продажи за месяц ({data.clients.length})</h2>
              <p className="px-5 text-xs text-slate-500">Клиенты, у которых в карточке указан продавец и дата покупки в этом месяце.</p>
              <table className="min-w-full text-sm mt-2">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>{['Дата', 'Клиент', ...(single ? [] : ['Менеджер']), 'Сумма'].map((h) => <th key={h} className="px-5 py-2 text-left font-bold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.clients.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/clients/${c.id}`)}>
                      <td className="px-5 py-2 tabular-nums whitespace-nowrap">{c.date.slice(8, 10)}.{c.date.slice(5, 7)}</td>
                      <td className="px-5 py-2">{c.name}{c.status === 'REFUND' && <span className="ml-2 text-xs text-red-600">возврат</span>}</td>
                      {!single && <td className="px-5 py-2 text-slate-500">{c.managerName}</td>}
                      <td className="px-5 py-2 tabular-nums">{fmtMoney(c.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>

      {planOpen && data && (
        <PlanModal
          month={monthStr}
          managers={data.managers}
          plans={data.managerPlans}
          onSave={savePlan}
          onClose={() => { setPlanOpen(false); load(); }}
        />
      )}
    </AppShell>
  );
}
