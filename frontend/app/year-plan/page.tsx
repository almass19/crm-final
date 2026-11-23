'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';
import OpPlanTable from '@/components/year-plan/OpPlanTable';
import TgPlanTable from '@/components/year-plan/TgPlanTable';
import { YearPlanData } from '@/components/year-plan/shared';
import { PLAN_YEAR } from '@/lib/year-plan';

type Tab = 'op' | 'tg';
const TABS: Record<Tab, string> = { op: 'План ОП', tg: 'План таргетологов' };
const FIRST_YEAR = 2026;

export default function YearPlanPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('op');
  const [year, setYear] = useState(PLAN_YEAR);
  const [data, setData] = useState<YearPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      setData(await api.getYearPlan(year));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, year]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    else if (user && !isAdmin) router.replace('/clients');
    else load();
  }, [authLoading, user, isAdmin, router, load]);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background-light text-slate-500">Загрузка...</div>;
  }
  if (!isAdmin) {
    return <div className="min-h-screen flex items-center justify-center bg-background-light text-red-500">Доступ запрещён</div>;
  }

  const years = Array.from({ length: Math.max(PLAN_YEAR, new Date().getFullYear()) - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
  const subtitle = tab === 'op'
    ? 'План: МОПы, заявки, продажи, чек, выручка и реклама — как в «Модели 2027». Факт — из CRM.'
    : 'План: платящие клиенты, новые проекты, продления и удержание — как в «Модели 2027». Факт — из CRM, по текущему таргетологу клиента.';

  return (
    <AppShell>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-4 sm:px-6 md:px-8 py-3 md:py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="tablist">
          {(Object.keys(TABS) as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tab === t ? 'bg-primary text-white font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {TABS[t]}
            </button>
          ))}
        </div>
        <select
          aria-label="Год"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="ml-auto"><NotificationBell /></div>
      </div>

      <div className="p-4 sm:p-6 md:p-8 space-y-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            {TABS[tab]} на {year} <span className="text-slate-400 font-bold">· из «Финмодели Resulting 2027»</span>
          </h1>
          <p className="text-slate-500 mt-1">{subtitle}</p>
          {year !== PLAN_YEAR && (
            <p className="mt-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
              План в финмодели есть только на {PLAN_YEAR} год — за {year} показан только факт.
            </p>
          )}
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}
        {loading && !data ? (
          <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />
        ) : data && (
          <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {tab === 'op' ? <OpPlanTable data={data} /> : <TgPlanTable data={data} />}
          </div>
        )}
      </div>
    </AppShell>
  );
}
