'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { ROLE_LABELS, STATUS_LABELS, TASK_STATUS_LABELS } from '@/lib/constants';
import Navbar from '@/components/Navbar';
import MonthSelector from '@/components/MonthSelector';
import StatusBadge from '@/components/StatusBadge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6B7280'];

interface Employee {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

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
  user?: { id: string; fullName: string; role: string };
}

interface AnalyticsData {
  totalClients: number;
  newClientsThisMonth: number;
  totalRevenue: number;
  completedTasks: number;
  clientsByStatus: { status: string; count: number }[];
  clientsByManager: { name: string; count: number }[];
  revenueByManager: { name: string; amount: number }[];
  tasksByStatus: { status: string; count: number }[];
  creativesByDesigner: { name: string; count: number }[];
}

type Tab = 'analytics' | 'employees';

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('analytics');

  // Shared
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  // Analytics tab
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Employees tab
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (user && user.role !== 'ADMIN') {
      router.replace('/clients');
      return;
    }
    if (user) {
      api.getEmployees().then(setEmployees).catch(() => {});
    }
  }, [authLoading, user, router]);

  // Fetch analytics
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await api.getAnalytics(selectedYear, selectedMonth);
      setAnalytics(data);
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    if (user && tab === 'analytics') {
      fetchAnalytics();
    }
  }, [user, tab, fetchAnalytics]);

  // Fetch employee dashboard
  const fetchEmployeeDashboard = useCallback(async () => {
    if (!selectedEmployeeId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getUserDashboard(selectedEmployeeId, selectedYear, selectedMonth);
      setDashboardData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeId, selectedYear, selectedMonth]);

  useEffect(() => {
    if (selectedEmployeeId && tab === 'employees') {
      fetchEmployeeDashboard();
    } else {
      setDashboardData(null);
    }
  }, [selectedEmployeeId, selectedYear, selectedMonth, tab, fetchEmployeeDashboard]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  const getRoleDashboardTitle = (role: string) => {
    switch (role) {
      case 'SPECIALIST':
      case 'DESIGNER':
        return 'Клиенты (принятые в работу)';
      case 'SALES_MANAGER':
        return 'Созданные клиенты';
      default:
        return 'Клиенты';
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ru-RU').format(value) + ' ₸';

  // Prepare chart data with labels
  const statusChartData = (analytics?.clientsByStatus || []).map(d => ({
    ...d,
    label: STATUS_LABELS[d.status] || d.status,
  }));

  const taskStatusChartData = (analytics?.tasksByStatus || []).map(d => ({
    ...d,
    label: TASK_STATUS_LABELS[d.status] || d.status,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Админ-панель
        </h1>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setTab('analytics')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'analytics'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Аналитика
          </button>
          <button
            onClick={() => setTab('employees')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'employees'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            По сотрудникам
          </button>
        </div>

        {/* Month selector (shared) */}
        <div className="flex flex-wrap gap-4 mb-6">
          {tab === 'employees' && (
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm min-w-[300px]"
            >
              <option value="">Выберите сотрудника</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({ROLE_LABELS[emp.role] || emp.role})
                </option>
              ))}
            </select>
          )}

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

        {/* ============ ANALYTICS TAB ============ */}
        {tab === 'analytics' && (
          analyticsLoading ? (
            <div className="text-center py-12 text-gray-500">Загрузка аналитики...</div>
          ) : analytics ? (
            <div>
              {/* Metric cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <MetricCard
                  label="Всего клиентов"
                  value={analytics.totalClients}
                  color="bg-blue-500"
                />
                <MetricCard
                  label="Новые за месяц"
                  value={analytics.newClientsThisMonth}
                  color="bg-green-500"
                />
                <MetricCard
                  label="Доход за месяц"
                  value={formatCurrency(analytics.totalRevenue)}
                  color="bg-yellow-500"
                />
                <MetricCard
                  label="Задач выполнено"
                  value={analytics.completedTasks}
                  color="bg-purple-500"
                />
              </div>

              {/* Charts row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Clients by manager */}
                <ChartCard title="Клиенты по менеджерам (за месяц)">
                  {analytics.clientsByManager.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.clientsByManager} layout="vertical" margin={{ left: 20 }}>
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Клиенты" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart />}
                </ChartCard>

                {/* Clients by status */}
                <ChartCard title="Клиенты по статусам">
                  {statusChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          dataKey="count"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          label={(props: any) => `${props.name}: ${props.value}`}
                        >
                          {statusChartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart />}
                </ChartCard>
              </div>

              {/* Charts row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Revenue by manager */}
                <ChartCard title="Зарплатный фонд (за месяц)">
                  {analytics.revenueByManager.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.revenueByManager} layout="vertical" margin={{ left: 20 }}>
                        <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => formatCurrency(value as number)} />
                        <Bar dataKey="amount" name="Доход" fill="#10B981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart />}
                </ChartCard>

                {/* Tasks by status */}
                <ChartCard title="Задачи по статусам (за месяц)">
                  {taskStatusChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={taskStatusChartData}>
                        <XAxis dataKey="label" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="Задачи" fill="#F59E0B" radius={[4, 4, 0, 0]}>
                          {taskStatusChartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart />}
                </ChartCard>
              </div>

              {/* Charts row 3 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Creatives by designer */}
                <ChartCard title="Креативы по дизайнерам (за месяц)">
                  {analytics.creativesByDesigner.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.creativesByDesigner} layout="vertical" margin={{ left: 20 }}>
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Креативы" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyChart />}
                </ChartCard>
              </div>
            </div>
          ) : null
        )}

        {/* ============ EMPLOYEES TAB ============ */}
        {tab === 'employees' && (
          !selectedEmployeeId ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
              Выберите сотрудника для просмотра статистики
            </div>
          ) : loading ? (
            <div className="text-center py-12 text-gray-500">Загрузка...</div>
          ) : dashboardData ? (
            <>
              {/* Employee Info & Stats */}
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {dashboardData.user?.fullName}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {ROLE_LABELS[dashboardData.user?.role || ''] || dashboardData.user?.role}
                    </p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h3 className="text-sm text-gray-500 mb-1">
                    {getRoleDashboardTitle(dashboardData.role)}
                  </h3>
                  <div className="text-4xl font-bold text-amber-600">
                    {dashboardData.count}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    клиентов за выбранный месяц
                  </p>
                </div>
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
          ) : null
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <div className={`w-2 h-2 rounded-full ${color} mb-3`} />
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <h3 className="text-sm font-medium text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
      Нет данных за выбранный период
    </div>
  );
}
