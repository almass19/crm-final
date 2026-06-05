'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/constants';
import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';
import StatusBadge from '@/components/StatusBadge';

interface Client {
  id: string;
  fullName: string | null;
  companyName: string | null;
  phone: string;
  niche: string | null;
  services: string[];
  status: string;
  paymentAmount: number | null;
  purchaseDate: string | null;
  launchDate: string | null;
  createdAt: string;
  assignedTo: { fullName: string } | null;
  designer: { fullName: string } | null;
}

const inputCls = "px-3 py-2 bg-slate-100 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-slate-400 text-slate-700";
const selectCls = "px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-slate-700";

function SkeletonRow() {
  return (
    <tr>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
          <div className="space-y-1.5">
            <div className="skeleton h-3.5 w-32" />
            <div className="skeleton h-3 w-20" />
          </div>
        </div>
      </td>
      <td className="px-6 py-4"><div className="skeleton h-3.5 w-28" /></td>
      <td className="px-6 py-4"><div className="skeleton h-3.5 w-20" /></td>
      <td className="px-6 py-4"><div className="skeleton h-3.5 w-24" /></td>
      <td className="px-6 py-4"><div className="skeleton h-3.5 w-24" /></td>
    </tr>
  );
}

export default function ArchivePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [nicheFilter, setNicheFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  const fetchClients = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { archived: 'true' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (nicheFilter) params.niche = nicheFilter;
      const data = await api.getClients(params);
      setClients(data);
    } catch {
      // error handled by api client
    } finally {
      setLoading(false);
    }
  }, [user, search, statusFilter, nicheFilter]);

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/login'); return; }
    if (!authLoading && user && user.role !== 'ADMIN' && user.role !== 'LEAD_DESIGNER') {
      router.replace('/clients');
      return;
    }
    if (user) fetchClients();
  }, [authLoading, user, fetchClients, router]);

  useEffect(() => {
    const timer = setTimeout(() => { if (user) fetchClients(); }, 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <div className="text-slate-500">Загрузка...</div>
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN';

  const displayedClients = monthFilter
    ? clients.filter((c) => c.purchaseDate?.startsWith(monthFilter))
    : clients;

  const availableMonths = Array.from(
    new Set(
      clients
        .filter((c) => c.purchaseDate)
        .map((c) => c.purchaseDate!.slice(0, 7))
    )
  )
    .sort((a, b) => b.localeCompare(a))
    .map((value) => {
      const [year, month] = value.split('-');
      const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
      return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });

  const hasActiveFilters = search || statusFilter || nicheFilter || monthFilter;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setNicheFilter('');
    setMonthFilter('');
  };

  return (
    <AppShell>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Поиск по имени, телефону..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 ${inputCls}`}
            />
          </div>
        </div>
        <NotificationBell />
      </div>

      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold font-display tracking-tight text-slate-900">Архив</h1>
          <p className="text-slate-500 mt-1">Завершённые клиенты</p>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
              <option value="">Все статусы</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Ниша..."
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value)}
              className={selectCls}
            />

            {availableMonths.length > 0 && (
              <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className={selectCls}>
                <option value="">Все месяцы</option>
                {availableMonths.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            )}

            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-sm text-slate-500 hover:text-primary font-medium transition-colors">
                Сбросить
              </button>
            )}

            <button
              onClick={fetchClients}
              className="ml-auto flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Обновить
            </button>
          </div>
        </div>

        {/* Counter */}
        {!loading && (
          <div className="mb-3 text-sm text-slate-500">
            {displayedClients.length === 0
              ? 'Клиенты не найдены'
              : clientWord(displayedClients.length)}
          </div>
        )}

        {loading ? (
          <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Компания', 'Дизайнер', 'Статус', 'Сумма', 'Дата покупки', 'Дата запуска', 'Специалист'].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        ) : displayedClients.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <h3 className="font-display font-semibold text-slate-900 mb-1">
              {hasActiveFilters ? 'Ничего не найдено' : 'Архив пуст'}
            </h3>
            <p className="text-sm text-slate-500">
              {hasActiveFilters ? 'Попробуйте изменить фильтры' : 'Завершённые клиенты будут отображаться здесь'}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-4 btn-secondary">
                Сбросить фильтры
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Компания', 'Дизайнер', 'Статус', ...(isAdmin ? ['Сумма'] : []), 'Дата покупки', 'Дата запуска', 'Специалист'].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
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
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs flex-shrink-0">
                          {(client.companyName || client.fullName || '?')[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-700">
                            {client.companyName || client.fullName}
                          </div>
                          {client.companyName && client.fullName && (
                            <div className="text-xs text-slate-400">{client.fullName}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {client.designer?.fullName || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={client.status} />
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                        {client.paymentAmount ? `${Number(client.paymentAmount).toLocaleString('ru-RU')} ₸` : '—'}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {client.purchaseDate ? new Date(client.purchaseDate).toLocaleDateString('ru-RU') : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {client.launchDate ? new Date(client.launchDate).toLocaleDateString('ru-RU') : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {client.assignedTo?.fullName || '—'}
                    </td>
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

function clientWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} клиентов`;
  if (mod10 === 1) return `${n} клиент`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} клиента`;
  return `${n} клиентов`;
}
