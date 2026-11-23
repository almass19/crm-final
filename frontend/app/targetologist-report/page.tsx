'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';
import ReportFunnel from '@/components/targetologist-report/ReportFunnel';
import Ranking from '@/components/targetologist-report/Ranking';
import CohortTable from '@/components/targetologist-report/CohortTable';
import { ReportData } from '@/components/targetologist-report/types';
import type { Period } from '@/lib/targetologist-report';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const PERIOD_LABELS: Record<Period, string> = { month: 'Месяц', quarter: 'Квартал', year: 'Год' };
const FIRST_YEAR = 2025;
const SELECT = 'px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40';

function periodTitle(period: Period, year: number, month: number): string {
  if (period === 'year') return `${year} год`;
  if (period === 'quarter') return `${Math.floor((month - 1) / 3) + 1} квартал ${year}`;
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export default function TargetologistReportPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const now = new Date();
  const [period, setPeriod] = useState<Period>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [personId, setPersonId] = useState('all');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      setData(await api.getTargetologistReport({ period, year, month, personId }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, period, year, month, personId]);

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

  const years = Array.from({ length: now.getFullYear() - FIRST_YEAR + 2 }, (_, i) => FIRST_YEAR + i);
  const personName = data?.people.find((p) => p.id === data.selected)?.name;

  return (
    <AppShell>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-4 sm:px-6 md:px-8 py-3 md:py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Период">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${period === p ? 'bg-primary text-white font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <select aria-label="Год" value={year} onChange={(e) => setYear(Number(e.target.value))} className={SELECT}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {period === 'month' && (
            <select aria-label="Месяц" value={month} onChange={(e) => setMonth(Number(e.target.value))} className={SELECT}>
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          )}
          {period === 'quarter' && (
            <select aria-label="Квартал" value={Math.floor((month - 1) / 3)} onChange={(e) => setMonth(Number(e.target.value) * 3 + 1)} className={SELECT}>
              {[0, 1, 2, 3].map((q) => <option key={q} value={q}>{q + 1} квартал</option>)}
            </select>
          )}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <select aria-label="Таргетолог" value={personId} onChange={(e) => setPersonId(e.target.value)} className={SELECT}>
            <option value="all">Вся команда</option>
            {data?.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <NotificationBell />
        </div>
      </div>

      <div className="p-4 sm:p-6 md:p-8 space-y-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Аналитика таргета <span className="text-slate-400 font-bold">· {periodTitle(period, year, month)}</span>
          </h1>
          <p className="text-slate-500 mt-1">
            {personName ? `${personName}. ` : 'Вся команда. '}
            Всё считается из CRM: клиенты по текущему таргетологу, продления — по оплатам. Оплата покрывает 30 дней.
          </p>
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

        {loading && !data ? (
          <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />
        ) : data && (
          <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <ReportFunnel data={data} />
            {data.selected === 'all' && data.people.length > 0 && <Ranking people={data.people} onPick={setPersonId} />}
            <CohortTable data={data} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
