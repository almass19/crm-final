'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { STATUS_LABELS, SERVICE_OPTIONS, CLIENT_TYPE_LABELS } from '@/lib/constants';
import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';

interface Client {
  id: string;
  fullName: string | null;
  companyName: string | null;
  phone: string;
  groupName: string | null;
  niche: string | null;
  services: string[];
  status: string;
  clientType: 'LEGAL' | 'INDIVIDUAL' | null;
  paymentAmount: number | null;
  assignmentSeen: boolean;
  designerAssignmentSeen: boolean;
  purchaseDate: string | null;
  launchDate: string | null;
  createdAt: string;
  createdBy: { fullName: string };
  assignedTo: { fullName: string } | null;
  designer: { fullName: string } | null;
}

interface UserOption {
  id: string;
  fullName: string;
  role: string;
}

const SPECIALIST_GROUPS = [
  { key: 'new', label: 'Новые', statuses: ['ASSIGNED', 'ONBOARDING', 'SETUP'] },
  { key: 'inwork', label: 'В работе', statuses: ['IN_WORK', 'RENEWAL'] },
  { key: 'paused', label: 'На паузе', statuses: ['PAUSED'] },
  { key: 'done', label: 'Завершённые', statuses: ['DONE'] },
];

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Сначала новые' },
  { value: 'createdAt:asc', label: 'Сначала старые' },
  { value: 'purchaseDate:desc', label: 'Дата покупки ↓' },
  { value: 'purchaseDate:asc', label: 'Дата покупки ↑' },
  { value: 'launchDate:desc', label: 'Дата запуска ↓' },
  { value: 'launchDate:asc', label: 'Дата запуска ↑' },
  { value: 'fullName:asc', label: 'По имени А-Я' },
  { value: 'fullName:desc', label: 'По имени Я-А' },
  { value: 'status:asc', label: 'По статусу' },
];

const selectCls = "px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-slate-700";
const inputCls = "px-3 py-2 bg-slate-100 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-slate-400 text-slate-700";

// Read initial filter value from URL (client-side only, safe in SSR)
function getUrlParam(key: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) || '';
}

// Skeleton row component
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
      <td className="px-6 py-4"><div className="skeleton h-3.5 w-24" /></td>
    </tr>
  );
}

export default function ClientsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusDropdown, setStatusDropdown] = useState<{ clientId: string; rect: DOMRect } | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'inwork'>('new');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [salesManagerFilter, setSalesManagerFilter] = useState('');
  const [specialistFilter, setSpecialistFilter] = useState('');
  const [nicheFilter, setNicheFilter] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [sortOption, setSortOption] = useState('purchaseDate:desc');
  const [salesManagers, setSalesManagers] = useState<UserOption[]>([]);
  const [specialists, setSpecialists] = useState<UserOption[]>([]);
  const [designers, setDesigners] = useState<UserOption[]>([]);
  const [designerFilter, setDesignerFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [urlInitialized, setUrlInitialized] = useState(false);

  // Initialize filters from URL on first client render
  useEffect(() => {
    setSearch(getUrlParam('search'));
    setStatusFilter(getUrlParam('status'));
    setNicheFilter(getUrlParam('niche'));
    setClientTypeFilter(getUrlParam('clientType'));
    setMonthFilter(getUrlParam('month'));
    setSalesManagerFilter(getUrlParam('soldById'));
    setSpecialistFilter(getUrlParam('specialistId'));
    setShowUnassigned(getUrlParam('unassigned') === 'true');
    setDesignerFilter(getUrlParam('designerId'));
    const sort = getUrlParam('sort');
    if (sort) setSortOption(sort);
    setUrlInitialized(true);
  }, []);

  // Sync filters to URL whenever they change (after init)
  useEffect(() => {
    if (!urlInitialized) return;
    const sp = new URLSearchParams();
    if (search) sp.set('search', search);
    if (statusFilter) sp.set('status', statusFilter);
    if (nicheFilter) sp.set('niche', nicheFilter);
    if (clientTypeFilter) sp.set('clientType', clientTypeFilter);
    if (monthFilter) sp.set('month', monthFilter);
    if (salesManagerFilter) sp.set('soldById', salesManagerFilter);
    if (specialistFilter) sp.set('specialistId', specialistFilter);
    if (designerFilter) sp.set('designerId', designerFilter);
    if (showUnassigned) sp.set('unassigned', 'true');
    if (sortOption !== 'purchaseDate:desc') sp.set('sort', sortOption);
    const qs = sp.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [search, statusFilter, nicheFilter, clientTypeFilter, monthFilter, salesManagerFilter, specialistFilter, designerFilter, showUnassigned, sortOption, urlInitialized]);

  const fetchClients = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (clientTypeFilter) params.clientType = clientTypeFilter;
      if (showUnassigned) params.unassigned = 'true';
      if (salesManagerFilter) params.soldById = salesManagerFilter;
      if (specialistFilter) params.specialistId = specialistFilter;
      if (designerFilter) params.designerId = designerFilter;
      if (nicheFilter) params.niche = nicheFilter;
      const [sortBy, sortOrder] = sortOption.split(':');
      params.sortBy = sortBy;
      params.sortOrder = sortOrder;
      const data = await api.getClients(params);
      setClients(data);
    } catch {
      // error handled by api client
    } finally {
      setLoading(false);
    }
  }, [user, search, statusFilter, clientTypeFilter, showUnassigned, salesManagerFilter, specialistFilter, designerFilter, nicheFilter, sortOption]);

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/login'); return; }
    if (user) {
      fetchClients();
      if (user.role === 'ADMIN' || user.role === 'LEAD_DESIGNER') {
        Promise.all([api.getUsers('sales_manager'), api.getUsers('admin')])
          .then(([managers, admins]) => setSalesManagers([...managers, ...admins]))
          .catch(() => {});
        Promise.all([api.getUsers('targetologist'), api.getUsers('admin'), api.getUsers('lead_designer')])
          .then(([specs, admins, leads]) => setSpecialists([...specs, ...admins, ...leads]))
          .catch(() => {});
        Promise.allSettled([api.getUsers('lead_designer'), api.getUsers('designer')])
          .then((results) => {
            const all = results
              .filter((r): r is PromiseFulfilledResult<UserOption[]> => r.status === 'fulfilled')
              .flatMap((r) => r.value);
            setDesigners(all);
          });
      }
    }
  }, [authLoading, user, fetchClients, router]);

  useEffect(() => {
    const timer = setTimeout(() => { if (user) fetchClients(); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!urlInitialized) return;
    if (salesManagerFilter || specialistFilter || designerFilter || showUnassigned) {
      setShowAdvancedFilters(true);
    }
  }, [urlInitialized]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!statusDropdown) return;
    const handler = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusDropdown]);

  const handleInlineStatusChange = async (clientId: string, newStatus: string) => {
    setStatusDropdown(null);
    setUpdatingStatusId(clientId);
    try {
      await api.updateClient(clientId, { status: newStatus });
      setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, status: newStatus } : c));
      showToast('Статус обновлён');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка обновления статуса';
      showToast(msg, 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <div className="text-slate-500">Загрузка...</div>
      </div>
    );
  }

  const isSpecialist = user.role === 'TARGETOLOGIST';
  const isDesigner = user.role === 'DESIGNER';
  const isSalesManager = user.role === 'SALES_MANAGER';
  const isAdmin = user.role === 'ADMIN';
  const isLeadDesigner = user.role === 'LEAD_DESIGNER';
  const hasNoRole = !user.role;

  const canChangeStatus = (_client: Client) =>
    isAdmin || isSpecialist;

  const openStatusDropdown = (e: React.MouseEvent<HTMLButtonElement>, clientId: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setStatusDropdown((prev) => prev?.clientId === clientId ? null : { clientId, rect });
  };

  if (hasNoRole) {
    return (
      <AppShell>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Ожидание роли</h2>
            <p className="text-slate-500">Ваш аккаунт ожидает назначения роли администратором.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const filteredClients = isDesigner
    ? activeTab === 'new'
      ? clients.filter((c) => !c.designerAssignmentSeen)
      : clients.filter((c) => c.designerAssignmentSeen)
    : clients;

  const displayedClients = monthFilter
    ? filteredClients.filter((c) => c.purchaseDate?.startsWith(monthFilter))
    : filteredClients;

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

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setClientTypeFilter(''); setShowUnassigned(false);
    setSalesManagerFilter(''); setSpecialistFilter(''); setDesignerFilter(''); setNicheFilter(''); setMonthFilter(''); setSortOption('purchaseDate:desc');
  };

  const hasActiveFilters = search || statusFilter || clientTypeFilter || showUnassigned || salesManagerFilter || specialistFilter || designerFilter || nicheFilter || monthFilter || sortOption !== 'purchaseDate:desc';

  return (
    <AppShell>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center gap-3 flex-1">
          {isDesigner && (
            <div className="flex bg-slate-100 rounded-lg p-1 flex-shrink-0">
              <button
                onClick={() => setActiveTab('new')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'new' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Новые
              </button>
              <button
                onClick={() => setActiveTab('inwork')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'inwork' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                В работе
              </button>
            </div>
          )}
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Поиск по имени, телефону, группе..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 ${inputCls}`}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <NotificationBell />
          {isAdmin && (
            <button
              onClick={() => router.push('/clients/import')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 transition-colors text-slate-600"
            >
              Импорт CSV
            </button>
          )}
          {(isSalesManager || isAdmin) && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-semibold shadow-sm shadow-primary/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Добавить клиента
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold font-display tracking-tight text-slate-900">Клиенты</h1>
          <p className="text-slate-500 mt-1">Управление базой клиентов и назначениями</p>
        </div>

        {/* Filters */}
        {!isDesigner && (
          <div className="card p-4 mb-6">
            {/* Row 1: Primary filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className={selectCls}>
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
                <option value="">Все статусы</option>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>

              <select value={clientTypeFilter} onChange={(e) => setClientTypeFilter(e.target.value)} className={selectCls}>
                <option value="">Все типы</option>
                {Object.entries(CLIENT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>

              {availableMonths.length > 0 && (
                <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className={selectCls}>
                  <option value="">Все месяцы</option>
                  {availableMonths.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              )}

              <input
                type="text"
                placeholder="Ниша..."
                value={nicheFilter}
                onChange={(e) => setNicheFilter(e.target.value)}
                className={selectCls}
              />

              {(isAdmin || isLeadDesigner) && (
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    showAdvancedFilters || salesManagerFilter || specialistFilter || designerFilter || showUnassigned
                      ? 'bg-primary/10 text-primary'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                  </svg>
                  Фильтры
                  {(salesManagerFilter || specialistFilter || designerFilter || showUnassigned) && (
                    <span className="ml-0.5 bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {[salesManagerFilter, specialistFilter, designerFilter, showUnassigned].filter(Boolean).length}
                    </span>
                  )}
                </button>
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

            {/* Row 2: Advanced filters (admin/lead-designer, collapsible) */}
            {(isAdmin || isLeadDesigner) && showAdvancedFilters && (
              <div className="flex flex-wrap gap-3 items-center mt-3 pt-3 border-t border-slate-100">
                <select value={salesManagerFilter} onChange={(e) => setSalesManagerFilter(e.target.value)} className={selectCls}>
                  <option value="">Все менеджеры</option>
                  {salesManagers.map((sm) => (<option key={sm.id} value={sm.id}>{sm.fullName}</option>))}
                </select>

                <select value={specialistFilter} onChange={(e) => setSpecialistFilter(e.target.value)} className={selectCls}>
                  <option value="">Все специалисты</option>
                  {specialists.map((sp) => (<option key={sp.id} value={sp.id}>{sp.fullName}</option>))}
                </select>

                {designers.length > 0 && (
                  <select value={designerFilter} onChange={(e) => setDesignerFilter(e.target.value)} className={selectCls}>
                    <option value="">Все дизайнеры</option>
                    {designers.map((d) => (<option key={d.id} value={d.id}>{d.fullName}</option>))}
                  </select>
                )}

                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showUnassigned}
                    onChange={(e) => setShowUnassigned(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary/40"
                  />
                  <span>Без специалиста</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Client counter */}
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
                  {(isAdmin
                    ? ['Компания', 'Телефон', 'Статус', 'Сумма', 'Дата покупки', 'Дата запуска', 'Специалист']
                    : isSalesManager
                    ? ['Компания', 'Телефон', 'Статус', 'Сумма', 'Дата покупки', 'Дата запуска']
                    : isLeadDesigner
                    ? ['Компания', 'Дизайнер', 'Статус', 'Дата покупки', 'Дата запуска']
                    : ['Компания', 'Телефон', 'Статус', 'Дата покупки', 'Дата запуска']
                  ).map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        ) : displayedClients.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <h3 className="font-display font-semibold text-slate-900 mb-1">
              {isDesigner && activeTab === 'new' ? 'Нет новых назначений' : hasActiveFilters ? 'Ничего не найдено' : 'Нет клиентов'}
            </h3>
            <p className="text-sm text-slate-500">
              {isDesigner && activeTab === 'new' ? 'Новые назначения появятся здесь' : hasActiveFilters ? 'Попробуйте изменить фильтры или сбросить их' : 'Добавьте первого клиента, чтобы начать работу'}
            </p>
            {hasActiveFilters && !isDesigner && (
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
                  {(isAdmin
                    ? ['Компания', 'Дизайнер', 'Статус', 'Сумма', 'Дата покупки', 'Дата запуска', 'Специалист']
                    : isSalesManager
                    ? ['Компания', 'Телефон', 'Статус', 'Сумма', 'Дата покупки', 'Дата запуска']
                    : isLeadDesigner
                    ? ['Компания', 'Дизайнер', 'Статус', 'Дата покупки', 'Дата запуска']
                    : ['Компания', 'Телефон', 'Статус', 'Дата покупки', 'Дата запуска']
                  ).map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {isSpecialist ? (
                  SPECIALIST_GROUPS.map(({ key, label, statuses }) => {
                    const groupClients = displayedClients.filter((c) => statuses.includes(c.status));
                    if (groupClients.length === 0) return null;
                    return (
                      <React.Fragment key={key}>
                        <tr>
                          <td colSpan={5} className="px-6 py-2 bg-slate-50 border-y border-slate-100">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                            <span className="ml-2 text-xs text-slate-400">{groupClients.length}</span>
                          </td>
                        </tr>
                        {groupClients.map((client) => (
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
                            <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{client.phone}</td>
                            <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              {canChangeStatus(client) ? (
                                <button
                                  onClick={(e) => openStatusDropdown(e, client.id)}
                                  disabled={updatingStatusId === client.id}
                                  className="group flex items-center gap-1 disabled:opacity-50"
                                >
                                  <StatusBadge status={client.status} />
                                  <svg className="w-3 h-3 text-slate-400 group-hover:text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                  </svg>
                                </button>
                              ) : (
                                <StatusBadge status={client.status} />
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                              {client.purchaseDate ? new Date(client.purchaseDate).toLocaleDateString('ru-RU') : '—'}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                              {client.launchDate ? new Date(client.launchDate).toLocaleDateString('ru-RU') : '—'}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })
                ) : (
                  displayedClients.map((client) => (
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
                        {(isAdmin || isLeadDesigner) ? (client.designer?.fullName || '—') : client.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {canChangeStatus(client) ? (
                          <button
                            onClick={(e) => openStatusDropdown(e, client.id)}
                            disabled={updatingStatusId === client.id}
                            className="group flex items-center gap-1 disabled:opacity-50"
                          >
                            <StatusBadge status={client.status} />
                            <svg className="w-3 h-3 text-slate-400 group-hover:text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        ) : (
                          <StatusBadge status={client.status} />
                        )}
                      </td>
                      {(isAdmin || isSalesManager) && (
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
                      {isAdmin && (
                        <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{client.assignedTo?.fullName || '—'}</td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {statusDropdown && (
        <div
          ref={statusDropdownRef}
          style={{
            position: 'fixed',
            top: statusDropdown.rect.bottom + 4,
            left: statusDropdown.rect.left,
            zIndex: 100,
          }}
          className="bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[190px]"
        >
          {Object.entries(STATUS_LABELS).map(([key, label]) => {
            const currentClient = clients.find((c) => c.id === statusDropdown.clientId);
            const isCurrent = currentClient?.status === key;
            return (
              <button
                key={key}
                onClick={() => handleInlineStatusChange(statusDropdown.clientId, key)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center justify-between ${isCurrent ? 'font-semibold text-primary' : 'text-slate-700'}`}
              >
                {label}
                {isCurrent && (
                  <svg className="w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateClientModal
          userRole={user.role}
          userId={user.id}
          userName={user.fullName}
          onClose={() => setShowCreateModal(false)}
          onCreated={(name) => {
            setShowCreateModal(false);
            fetchClients();
            showToast(`Клиент «${name}» успешно создан`);
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}
    </AppShell>
  );
}

// Russian pluralization for "клиент"
function clientWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} клиентов`;
  if (mod10 === 1) return `${n} клиент`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} клиента`;
  return `${n} клиентов`;
}

function CreateClientModal({
  userRole, userId, userName, onClose, onCreated, onError,
}: {
  userRole: string | null; userId: string; userName: string;
  onClose: () => void;
  onCreated: (name: string) => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    fullName: '', companyName: '', phone: '', groupName: '',
    services: [] as string[], notes: '', paymentAmount: '',
    soldById: userRole === 'SALES_MANAGER' ? userId : '', purchaseDate: '', niche: '',
    clientType: '' as 'LEGAL' | 'INDIVIDUAL' | '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [salesManagers, setSalesManagers] = useState<{ id: string; fullName: string }[]>([]);
  const isAdmin = userRole === 'ADMIN';

  useEffect(() => {
    if (isAdmin) {
      Promise.allSettled([api.getUsers('sales_manager'), api.getUsers('admin')])
        .then((results) => {
          const merged: { id: string; fullName: string }[] = results
            .filter((r): r is PromiseFulfilledResult<{ id: string; fullName: string }[]> => r.status === 'fulfilled')
            .flatMap((r) => r.value);
          const withSelf = [{ id: userId, fullName: userName }, ...merged];
          const unique = withSelf.filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i);
          setSalesManagers(unique);
        });
    }
  }, [isAdmin, userId, userName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName && !form.companyName) { setError('Укажите ФИО или название компании'); return; }
    if (!form.clientType) { setError('Выберите тип оплаты: Юр. лицо или Физ. лицо'); return; }
    if (form.services.length === 0) { setError('Выберите хотя бы одну услугу'); return; }
    setError('');
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = {};
      if (form.fullName) data.fullName = form.fullName;
      if (form.companyName) data.companyName = form.companyName;
      data.phone = form.phone;
      data.clientType = form.clientType;
      if (form.groupName) data.groupName = form.groupName;
      if (form.niche) data.niche = form.niche;
      data.services = form.services;
      if (form.notes) data.notes = form.notes;
      if (form.paymentAmount) data.paymentAmount = parseFloat(form.paymentAmount);
      if (form.soldById) data.soldById = form.soldById;
      if (form.purchaseDate) data.purchaseDate = form.purchaseDate;
      await api.createClient(data);
      onCreated(form.companyName || form.fullName || 'Клиент');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка создания';
      setError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldCls = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";
  const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-900">Новый клиент</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Тип оплаты *</label>
              <div className="flex gap-3">
                {(['LEGAL', 'INDIVIDUAL'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, clientType: type })}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                      form.clientType === type
                        ? 'bg-primary text-white border-primary'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {type === 'LEGAL' ? 'Юр. лицо' : 'Физ. лицо'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>ФИО</label>
              <input type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={fieldCls} placeholder="Иванов Иван Иванович" />
            </div>
            <div>
              <label className={labelCls}>Название компании</label>
              <input type="text" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className={fieldCls} placeholder="ООО 'Компания'" />
            </div>
            <div>
              <label className={labelCls}>Телефон *</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className={fieldCls} placeholder="+7 (999) 123-45-67" />
            </div>
            <div>
              <label className={labelCls}>Ниша</label>
              <input type="text" value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} className={fieldCls} placeholder="Например: E-commerce, Медицина..." />
            </div>
            <div>
              <label className={labelCls}>Название группы</label>
              <input type="text" value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} className={fieldCls} placeholder="Название группы" />
            </div>
            <div>
              <label className={labelCls}>Услуги *</label>
              <div className="space-y-2">
                {SERVICE_OPTIONS.map((service) => (
                  <label key={service} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.services.includes(service)}
                      onChange={(e) => {
                        if (e.target.checked) setForm({ ...form, services: [...form.services, service] });
                        else setForm({ ...form, services: form.services.filter((s) => s !== service) });
                      }}
                      className="rounded border-slate-300 text-primary focus:ring-primary/40"
                    />
                    <span className="text-sm text-slate-700">{service}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Сумма оплаты (₸)</label>
              <input type="number" value={form.paymentAmount} onChange={(e) => setForm({ ...form, paymentAmount: e.target.value })} min="0" step="0.01" className={fieldCls} placeholder="0.00" />
            </div>
            {isAdmin && (
              <div>
                <label className={labelCls}>Менеджер</label>
                <select value={form.soldById} onChange={(e) => setForm({ ...form, soldById: e.target.value })} className={fieldCls}>
                  <option value="">Не указан</option>
                  {salesManagers.map((sm) => (<option key={sm.id} value={sm.id}>{sm.fullName}</option>))}
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>Дата покупки</label>
              <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Заметки</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={fieldCls} placeholder="Дополнительная информация..." />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium">
                Отмена
              </button>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity text-sm font-semibold">
                {submitting ? 'Сохранение...' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
