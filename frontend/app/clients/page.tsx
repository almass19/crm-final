'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { STATUS_LABELS, SERVICE_OPTIONS } from '@/lib/constants';
import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';
import StatusBadge from '@/components/StatusBadge';

interface Client {
  id: string;
  fullName: string | null;
  companyName: string | null;
  phone: string;
  groupName: string | null;
  services: string[];
  status: string;
  assignmentSeen: boolean;
  designerAssignmentSeen: boolean;
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

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Сначала новые' },
  { value: 'createdAt:asc', label: 'Сначала старые' },
  { value: 'fullName:asc', label: 'По имени А-Я' },
  { value: 'fullName:desc', label: 'По имени Я-А' },
  { value: 'status:asc', label: 'По статусу' },
];

const selectCls = "px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-slate-700";
const inputCls = "px-3 py-2 bg-slate-100 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-slate-400 text-slate-700";

export default function ClientsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'inwork'>('new');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [salesManagerFilter, setSalesManagerFilter] = useState('');
  const [specialistFilter, setSpecialistFilter] = useState('');
  const [sortOption, setSortOption] = useState('createdAt:desc');
  const [salesManagers, setSalesManagers] = useState<UserOption[]>([]);
  const [specialists, setSpecialists] = useState<UserOption[]>([]);

  const fetchClients = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (showUnassigned) params.unassigned = 'true';
      if (salesManagerFilter) params.soldById = salesManagerFilter;
      if (specialistFilter) params.specialistId = specialistFilter;
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
  }, [user, search, statusFilter, showUnassigned, salesManagerFilter, specialistFilter, sortOption]);

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/login'); return; }
    if (user) {
      fetchClients();
      if (user.role === 'ADMIN' || user.role === 'LEAD_DESIGNER') {
        Promise.all([api.getUsers('sales_manager'), api.getUsers('admin')])
          .then(([managers, admins]) => setSalesManagers([...managers, ...admins]))
          .catch(() => {});
        Promise.all([api.getUsers('specialist'), api.getUsers('admin')])
          .then(([specs, admins]) => setSpecialists([...specs, ...admins]))
          .catch(() => {});
      }
    }
  }, [authLoading, user, fetchClients, router]);

  useEffect(() => {
    const timer = setTimeout(() => { if (user) fetchClients(); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <div className="text-slate-500">Загрузка...</div>
      </div>
    );
  }

  const isSpecialist = user.role === 'SPECIALIST';
  const isDesigner = user.role === 'DESIGNER';
  const isSalesManager = user.role === 'SALES_MANAGER';
  const isAdmin = user.role === 'ADMIN';
  const isLeadDesigner = user.role === 'LEAD_DESIGNER';
  const hasNoRole = !user.role;

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

  const filteredClients = isSpecialist
    ? activeTab === 'new'
      ? clients.filter((c) => !c.assignmentSeen && c.status === 'ASSIGNED')
      : clients.filter((c) => c.assignmentSeen || c.status === 'IN_WORK' || c.status === 'DONE')
    : isDesigner
    ? activeTab === 'new'
      ? clients.filter((c) => !c.designerAssignmentSeen)
      : clients.filter((c) => c.designerAssignmentSeen)
    : clients;

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setShowUnassigned(false);
    setSalesManagerFilter(''); setSpecialistFilter(''); setSortOption('createdAt:desc');
  };

  const hasActiveFilters = search || statusFilter || showUnassigned || salesManagerFilter || specialistFilter || sortOption !== 'createdAt:desc';

  return (
    <AppShell>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center gap-3 flex-1">
          {!isSpecialist && !isDesigner && (
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
          )}
          {(isSpecialist || isDesigner) && (
            <div className="flex bg-slate-100 rounded-lg p-1">
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
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Клиенты</h1>
          <p className="text-slate-500 mt-1">Управление базой клиентов и назначениями</p>
        </div>

        {/* Filters (admin/lead designer) */}
        {!isSpecialist && !isDesigner && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
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

              {(isAdmin || isLeadDesigner) && (
                <>
                  <select value={salesManagerFilter} onChange={(e) => setSalesManagerFilter(e.target.value)} className={selectCls}>
                    <option value="">Все менеджеры</option>
                    {salesManagers.map((sm) => (<option key={sm.id} value={sm.id}>{sm.fullName}</option>))}
                  </select>

                  <select value={specialistFilter} onChange={(e) => setSpecialistFilter(e.target.value)} className={selectCls}>
                    <option value="">Все специалисты</option>
                    {specialists.map((sp) => (<option key={sp.id} value={sp.id}>{sp.fullName}</option>))}
                  </select>

                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showUnassigned}
                      onChange={(e) => setShowUnassigned(e.target.checked)}
                      className="rounded border-slate-300 text-primary focus:ring-primary/40"
                    />
                    <span>Без специалиста</span>
                  </label>
                </>
              )}

              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-sm text-primary hover:underline font-medium">
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
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">Загрузка...</div>
        ) : filteredClients.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-500">
            {(isSpecialist || isDesigner) && activeTab === 'new' ? 'Нет новых назначений' : 'Клиенты не найдены'}
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Имя / Компания', 'Телефон', 'Группа', 'Услуги', 'Статус', 'Специалист', 'Дизайнер', 'Дата'].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                          {(client.fullName || client.companyName || '?')[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {client.fullName || client.companyName}
                          </div>
                          {client.fullName && client.companyName && (
                            <div className="text-xs text-slate-500">{client.companyName}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{client.phone}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{client.groupName || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{client.services?.join(', ') || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={client.status} /></td>
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{client.assignedTo?.fullName || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{client.designer?.fullName || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {new Date(client.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateClientModal
          userRole={user.role}
          userId={user.id}
          userName={user.fullName}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchClients(); }}
        />
      )}
    </AppShell>
  );
}

function CreateClientModal({
  userRole, userId, userName, onClose, onCreated,
}: {
  userRole: string | null; userId: string; userName: string; onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState({
    fullName: '', companyName: '', phone: '', groupName: '',
    services: [] as string[], notes: '', paymentAmount: '',
    soldById: userRole === 'SALES_MANAGER' ? userId : '', createdAt: '',
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
          // Ensure current admin is always present, deduplicate by id
          const withSelf = [{ id: userId, fullName: userName }, ...merged];
          const unique = withSelf.filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i);
          setSalesManagers(unique);
        });
    }
  }, [isAdmin, userId, userName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName && !form.companyName) { setError('Укажите ФИО или название компании'); return; }
    if (form.services.length === 0) { setError('Выберите хотя бы одну услугу'); return; }
    setError('');
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = {};
      if (form.fullName) data.fullName = form.fullName;
      if (form.companyName) data.companyName = form.companyName;
      data.phone = form.phone;
      if (form.groupName) data.groupName = form.groupName;
      data.services = form.services;
      if (form.notes) data.notes = form.notes;
      if (form.paymentAmount) data.paymentAmount = parseFloat(form.paymentAmount);
      if (form.soldById) data.soldById = form.soldById;
      if (isAdmin && form.createdAt) data.createdAt = form.createdAt;
      await api.createClient(data);
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
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
                <label className={labelCls}>Продавец</label>
                <select value={form.soldById} onChange={(e) => setForm({ ...form, soldById: e.target.value })} className={fieldCls}>
                  <option value="">Не указан</option>
                  {salesManagers.map((sm) => (<option key={sm.id} value={sm.id}>{sm.fullName}</option>))}
                </select>
              </div>
            )}
            {isAdmin && (
              <div className="border-t border-slate-100 pt-4">
                <label className={labelCls}>Дата создания</label>
                <p className="text-xs text-slate-500 mb-2">Оставьте пустым для текущей даты</p>
                <input type="datetime-local" value={form.createdAt} onChange={(e) => setForm({ ...form, createdAt: e.target.value })} className={fieldCls} />
              </div>
            )}
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
