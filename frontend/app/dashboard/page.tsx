'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/constants';
import Navbar from '@/components/Navbar';
import MonthSelector from '@/components/MonthSelector';
import StatusBadge from '@/components/StatusBadge';

interface DashboardClient {
  id: string;
  fullName: string | null;
  companyName: string | null;
  phone: string;
  groupName: string | null;
  status: string;
  services: string[];
  createdAt: string;
  assignedAt: string | null;
  designerAssignedAt: string | null;
}

interface DashboardData {
  count: number;
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
      // Only SPECIALIST, DESIGNER, SALES_MANAGER can see personal dashboard
      if (!['ADMIN', 'SPECIALIST', 'DESIGNER', 'SALES_MANAGER', 'LEAD_DESIGNER'].includes(user.role || '')) {
        router.replace('/clients');
        return;
      }
      fetchDashboard();
    }
  }, [authLoading, user, fetchDashboard, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  const getRoleDashboardTitle = () => {
    switch (user.role) {
      case 'SPECIALIST':
        return 'Мои клиенты (принятые в работу)';
      case 'DESIGNER':
        return 'Мои клиенты (принятые в работу)';
      case 'ADMIN':
      case 'SALES_MANAGER':
        return 'Мои созданные клиенты';
      case 'LEAD_DESIGNER':
        return 'Мои клиенты (как дизайнер)';
      default:
        return 'Мой дашборд';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Мой дашборд</h1>
            <p className="text-sm text-gray-500 mt-1">
              {ROLE_LABELS[user.role || ''] || user.role}
            </p>
          </div>
          <MonthSelector
            year={selectedYear}
            month={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Загрузка...</div>
        ) : dashboardData ? (
          <>
            {/* Stats Card */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {getRoleDashboardTitle()}
              </h2>
              <div className="text-4xl font-bold text-amber-600">
                {dashboardData.count}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                клиентов за выбранный месяц
              </p>
            </div>

            {/* Clients Table */}
            {dashboardData.clients.length > 0 ? (
              <div className="bg-white shadow-sm rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Имя / Компания
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Контакты
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Услуги
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Статус
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Дата
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dashboardData.clients.map((client) => (
                      <tr
                        key={client.id}
                        onClick={() => router.push(`/clients/${client.id}`)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {client.fullName || client.companyName}
                          </div>
                          {client.fullName && client.companyName && (
                            <div className="text-xs text-gray-500">
                              {client.companyName}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{client.phone}</div>
                          <div className="text-xs">{client.groupName || ''}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {client.services?.join(', ') || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={client.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(
                            client.assignedAt || client.designerAssignedAt || client.createdAt
                          ).toLocaleDateString('ru-RU')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
                Нет клиентов за выбранный период
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
