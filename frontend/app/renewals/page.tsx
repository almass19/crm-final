'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';

interface RenewalClient {
  clientId: string;
  clientName: string;
  amount: number;
  renewedAt: string;
  specialist: { id: string; fullName: string } | null;
}

interface RenewalsData {
  month: string;
  totalRenewals: number;
  clients: RenewalClient[];
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export default function RenewalsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<RenewalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const getMonthString = useCallback(() => {
    return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  }, [selectedYear, selectedMonth]);

  const fetchRenewals = useCallback(async () => {
    if (!user) return;
    if (user.role !== 'ADMIN' && user.role !== 'SPECIALIST') {
      router.replace('/clients');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.getRenewals(getMonthString());
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [user, router, getMonthString]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (user) {
      fetchRenewals();
    }
  }, [authLoading, user, fetchRenewals, router]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1); }
    else setSelectedMonth(selectedMonth - 1);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1); }
    else setSelectedMonth(selectedMonth + 1);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <div className="text-slate-500">Загрузка...</div>
      </div>
    );
  }

  if (user.role !== 'ADMIN' && user.role !== 'SPECIALIST') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <div className="text-red-500">Доступ запрещён</div>
      </div>
    );
  }

  return (
    <AppShell>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
        {/* Month Navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-slate-900 min-w-[150px] text-center">
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Продлеваемые</h1>
          <p className="text-slate-500 mt-1">Клиенты с продлениями за выбранный месяц</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">Загрузка...</div>
        ) : (
          <>
            {/* Summary Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Всего продлений за месяц
                  </p>
                  <p className="text-4xl font-black text-green-600">{data?.totalRenewals || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Table */}
            {data && data.clients.length > 0 ? (
              <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Клиент</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Сумма</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Дата продления</th>
                      {user.role === 'ADMIN' && (
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Специалист</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {data.clients.map((client, index) => (
                      <tr key={`${client.clientId}-${index}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <button
                            onClick={() => router.push(`/clients/${client.clientId}`)}
                            className="text-sm font-semibold text-primary hover:underline"
                          >
                            {client.clientName}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                          {client.amount.toLocaleString('ru-RU')} ₸
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {new Date(client.renewedAt).toLocaleDateString('ru-RU')}
                        </td>
                        {user.role === 'ADMIN' && (
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {client.specialist?.fullName || '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-500">
                Нет продлений за выбранный месяц
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
