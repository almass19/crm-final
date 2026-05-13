'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/constants';
import AppShell from '@/components/AppShell';
import MonthSelector from '@/components/MonthSelector';
import StatusBadge from '@/components/StatusBadge';
import NotificationBell from '@/components/NotificationBell';

interface DashboardClient {
  id: string;
  fullName: string | null;
  companyName: string | null;
  phone: string;
  groupName: string | null;
  status: string;
  services: string[];
  purchaseDate: string | null;
  createdAt: string;
  assignedAt: string | null;
  designerAssignedAt: string | null;
}

interface DashboardData {
  count: number;
  createdCount?: number;
  specialistCount?: number;
  clients: DashboardClient[];
  month: number;
  year: number;
  role: string;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getMyDashboard(selectedYear, selectedMonth);
      setDashboardData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [user, selectedYear, selectedMonth]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (user) {
      if (!['ADMIN', 'TARGETOLOGIST', 'DESIGNER', 'SALES_MANAGER', 'LEAD_DESIGNER'].includes(user.role || '')) {
        router.replace('/clients');
        return;
      }
      fetchDashboard();
    }
  }, [authLoading, user, fetchDashboard, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <div className="text-slate-500">Загрузка...</div>
      </div>
    );
  }

  const getRoleDashboardTitle = () => {
    switch (user.role) {
      case 'TARGETOLOGIST': return 'Мои клиенты (принятые в работу)';
      case 'DESIGNER': return 'Мои клиенты (принятые в работу)';
      case 'ADMIN':
      case 'SALES_MANAGER': return 'Мои созданные клиенты';
      case 'LEAD_DESIGNER': return 'Мои клиенты (как дизайнер)';
      default: return 'Мой дашборд';
    }
  };

  return (
    <AppShell>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center gap-4 flex-1">
          <MonthSelector
            year={selectedYear}
            month={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
          />
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display tracking-tight text-slate-900">Мой дашборд</h1>
          <p className="text-slate-500 mt-1">{ROLE_LABELS[user.role || ''] || user.role}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="card p-6">
              <div className="skeleton h-3 w-32 mb-3" />
              <div className="skeleton h-10 w-20 mb-2" />
              <div className="skeleton h-3 w-40" />
            </div>
            <div className="card overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3.5 w-1/3" />
                    <div className="skeleton h-3 w-1/5" />
                  </div>
                  <div className="skeleton h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ) : dashboardData ? (
          <>
            {/* Stats Card */}
            {user.role === 'ADMIN' && dashboardData.createdCount !== undefined ? (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="card p-6 border-l-4 border-primary">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Созданные клиенты</p>
                  <div className="text-4xl font-black text-primary">{dashboardData.createdCount}</div>
                  <p className="text-sm text-slate-500 mt-1">за выбранный месяц</p>
                </div>
                <div className="card p-6 border-l-4 border-success">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Как специалист</p>
                  <div className="text-4xl font-black text-success-text">{dashboardData.specialistCount}</div>
                  <p className="text-sm text-slate-500 mt-1">за выбранный месяц</p>
                </div>
              </div>
            ) : (
              <div className="card p-6 mb-6 border-l-4 border-primary">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {getRoleDashboardTitle()}
                </p>
                <div className="text-4xl font-black text-primary">
                  {dashboardData.count}
                </div>
                <p className="text-sm text-slate-500 mt-1">клиентов за выбранный месяц</p>
              </div>
            )}

            {/* Clients Table */}
            {dashboardData.clients.length > 0 ? (
              <div className="card overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Имя / Компания', 'Контакты', 'Услуги', 'Статус', 'Дата'].map((h) => (
                        <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {dashboardData.clients.map((client) => (
                      <tr
                        key={client.id}
                        onClick={() => router.push(`/clients/${client.id}`)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-slate-900">
                            {client.fullName || client.companyName}
                          </div>
                          {client.fullName && client.companyName && (
                            <div className="text-xs text-slate-500">{client.companyName}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-600">{client.phone}</div>
                          <div className="text-xs text-slate-400">{client.groupName || ''}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {client.services?.join(', ') || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={client.status} />
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {client.purchaseDate ? new Date(client.purchaseDate).toLocaleDateString('ru-RU') : (client.assignedAt || client.designerAssignedAt ? new Date(client.assignedAt || client.designerAssignedAt!).toLocaleDateString('ru-RU') : '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card p-12 text-center">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Нет клиентов</p>
                <p className="text-sm text-slate-500">За выбранный период активности не найдено</p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
