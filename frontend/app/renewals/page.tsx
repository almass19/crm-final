'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';
import StatusBadge from '@/components/StatusBadge';

interface Client {
  id: string;
  fullName: string | null;
  companyName: string | null;
  phone: string;
  status: string;
  purchaseDate: string | null;
  launchDate: string | null;
  assignedTo: { id: string; fullName: string } | null;
  designer: { fullName: string } | null;
}

interface UserOption {
  id: string;
  fullName: string;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export default function RenewalsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [totalRenewals, setTotalRenewals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [specialists, setSpecialists] = useState<UserOption[]>([]);
  const [specialistFilter, setSpecialistFilter] = useState('');

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const getMonthString = useCallback(() => {
    return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  }, [selectedYear, selectedMonth]);

  const fetchRenewals = useCallback(async () => {
    if (!user) return;
    if (user.role !== 'ADMIN' && user.role !== 'TARGETOLOGIST') {
      router.replace('/clients');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.getRenewals(getMonthString());
      setClients(result.clients);
      setTotalRenewals(result.totalRenewals);
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
      if (user.role === 'ADMIN') {
        Promise.all([api.getUsers('targetologist'), api.getUsers('admin'), api.getUsers('lead_designer')])
          .then(([specs, admins, leads]) => setSpecialists([...specs, ...admins, ...leads]))
          .catch(() => {});
      }
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

  if (user.role !== 'ADMIN' && user.role !== 'TARGETOLOGIST') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <div className="text-red-500">Доступ запрещён</div>
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN';

  const displayedClients = specialistFilter
    ? clients.filter((c) => c.assignedTo?.id === specialistFilter)
    : clients;

  return (
    <AppShell>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
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
          {isAdmin && specialists.length > 0 && (
            <select
              value={specialistFilter}
              onChange={(e) => setSpecialistFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-slate-700"
            >
              <option value="">Все таргетологи</option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id}>{s.fullName}</option>
              ))}
            </select>
          )}
          <NotificationBell />
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Продляемые</h1>
          <p className="text-slate-500 mt-1">
            {displayedClients.length > 0 ? `${displayedClients.length} клиент${displayedClients.length === 1 ? '' : displayedClients.length < 5 ? 'а' : 'ов'} с продлением` : 'Нет продлений за выбранный месяц'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
        )}

        {loading ? (
          <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {(isAdmin
                    ? ['Компания', 'Дизайнер', 'Статус', 'Дата покупки', 'Дата запуска', 'Специалист']
                    : ['Компания', 'Телефон', 'Статус', 'Дата покупки', 'Дата запуска']
                  ).map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: isAdmin ? 6 : 5 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : displayedClients.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-500">
            Нет продлений за выбранный месяц
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {(isAdmin
                    ? ['Компания', 'Дизайнер', 'Статус', 'Дата покупки', 'Дата запуска', 'Специалист']
                    : ['Компания', 'Телефон', 'Статус', 'Дата покупки', 'Дата запуска']
                  ).map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {displayedClients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                          {(client.companyName || client.fullName || '?')[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {client.companyName || client.fullName}
                          </div>
                          {client.companyName && client.fullName && (
                            <div className="text-xs text-slate-500">{client.fullName}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {isAdmin ? (client.designer?.fullName || '—') : client.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={client.status} /></td>
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {client.purchaseDate ? new Date(client.purchaseDate).toLocaleDateString('ru-RU') : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {client.launchDate ? new Date(client.launchDate).toLocaleDateString('ru-RU') : '—'}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                        {client.assignedTo?.fullName || '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
