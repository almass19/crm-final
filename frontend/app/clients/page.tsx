'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { STATUS_LABELS, SERVICE_OPTIONS } from '@/lib/constants';
import Navbar from '@/components/Navbar';
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

  // New filter states
  const [salesManagerFilter, setSalesManagerFilter] = useState('');
  const [specialistFilter, setSpecialistFilter] = useState('');
  const [sortOption, setSortOption] = useState('createdAt:desc');

  // Users for filters (admin only)
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
      if (salesManagerFilter) params.createdById = salesManagerFilter;
      if (specialistFilter) params.specialistId = specialistFilter;

      // Parse sort option
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
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (user) {
      fetchClients();
      // Fetch filter options for admin and lead designer
      if (user.role === 'ADMIN' || user.role === 'LEAD_DESIGNER') {
        api.getUsers('sales_manager').then(setSalesManagers).catch(() => {});
        api.getUsers('specialist').then(setSpecialists).catch(() => {});
      }
    }
  }, [authLoading, user, fetchClients, router]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user) fetchClients();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
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
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="bg-white rounded-lg shadow-md p-8 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Ожидание роли</h2>
            <p className="text-gray-500">
              Ваш аккаунт ожидает назначения роли администратором.
            </p>
          </div>
        </div>
      </div>
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
    setSearch('');
    setStatusFilter('');
    setShowUnassigned(false);
    setSalesManagerFilter('');
    setSpecialistFilter('');
    setSortOption('createdAt:desc');
  };

  const hasActiveFilters = search || statusFilter || showUnassigned || salesManagerFilter || specialistFilter || sortOption !== 'createdAt:desc';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Клиенты</h1>
          <div className="flex gap-3">
            {isAdmin && (
              <button
                onClick={() => router.push('/clients/import')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Импорт CSV
              </button>
            )}
            {(isSalesManager || isAdmin) && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-amber-500 text-gray-900 rounded-md hover:bg-amber-600 transition-colors text-sm font-medium"
              >
                + Добавить клиента
              </button>
            )}
          </div>
        </div>

        {(isSpecialist || isDesigner) && (
          <div className="flex space-x-1 mb-6 bg-gray-200 rounded-lg p-1 max-w-xs">
            <button
              onClick={() => setActiveTab('new')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'new'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Новые
            </button>
            <button
              onClick={() => setActiveTab('inwork')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'inwork'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              В работе
            </button>
          </div>
        )}

        {!isSpecialist && !isDesigner && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            {/* Search Row */}
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="flex-1 min-w-[300px]">
                <input
                  type="text"
                  placeholder="Поиск по имени, телефону, группе..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap gap-4 items-center">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              >
                <option value="">Все статусы</option>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>

              {(isAdmin || isLeadDesigner) && (
                <>
                  <select
                    value={salesManagerFilter}
                    onChange={(e) => setSalesManagerFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  >
                    <option value="">Все менеджеры</option>
                    {salesManagers.map((sm) => (
                      <option key={sm.id} value={sm.id}>
                        {sm.fullName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={specialistFilter}
                    onChange={(e) => setSpecialistFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  >
                    <option value="">Все специалисты</option>
                    {specialists.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.fullName}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center space-x-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={showUnassigned}
                      onChange={(e) => setShowUnassigned(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span>Без специалиста</span>
                  </label>
                </>
              )}

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Сбросить фильтры
                </button>
              )}

              <button
                onClick={fetchClients}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm ml-auto"
              >
                Обновить
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Загрузка...</div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {(isSpecialist || isDesigner) && activeTab === 'new'
              ? 'Нет новых назначений'
              : 'Клиенты не найдены'}
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Имя / Компания
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Телефон
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Группа
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Услуги
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Специалист
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Дизайнер
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Дата
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className="hover:bg-amber-50 cursor-pointer transition-colors"
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
                      {client.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.groupName || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {client.services?.join(', ') || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={client.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.assignedTo?.fullName || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.designer?.fullName || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchClients();
          }}
        />
      )}
    </div>
  );
}

function CreateClientModal({
  userRole,
  userId,
  onClose,
  onCreated,
}: {
  userRole: string | null;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    fullName: '',
    companyName: '',
    phone: '',
    groupName: '',
    services: [] as string[],
    notes: '',
    paymentAmount: '',
    soldById: userRole === 'SALES_MANAGER' ? userId : '',
    createdAt: '',
    assignedAt: '',
    designerAssignedAt: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [salesManagers, setSalesManagers] = useState<{ id: string; fullName: string }[]>([]);

  const isAdmin = userRole === 'ADMIN';

  useEffect(() => {
    if (isAdmin) {
      api.getUsers('sales_manager').then(setSalesManagers).catch(() => {});
    }
  }, [isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName && !form.companyName) {
      setError('Укажите ФИО или название компании');
      return;
    }
    if (form.services.length === 0) {
      setError('Выберите хотя бы одну услугу');
      return;
    }
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
      if (isAdmin && form.assignedAt) data.assignedAt = form.assignedAt;
      if (isAdmin && form.designerAssignedAt) data.designerAssignedAt = form.designerAssignedAt;
      await api.createClient(data);
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Новый клиент
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ФИО
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) =>
                  setForm({ ...form, fullName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Иванов Иван Иванович"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название компании
              </label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) =>
                  setForm({ ...form, companyName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="ООО 'Компания'"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Телефон *
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="+7 (999) 123-45-67"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название группы
              </label>
              <input
                type="text"
                value={form.groupName}
                onChange={(e) => setForm({ ...form, groupName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Название группы"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Услуги *
              </label>
              <div className="space-y-2">
                {SERVICE_OPTIONS.map((service) => (
                  <label key={service} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.services.includes(service)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm({ ...form, services: [...form.services, service] });
                        } else {
                          setForm({ ...form, services: form.services.filter((s) => s !== service) });
                        }
                      }}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-700">{service}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сумма оплаты (₸)
              </label>
              <input
                type="number"
                value={form.paymentAmount}
                onChange={(e) => setForm({ ...form, paymentAmount: e.target.value })}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="0.00"
              />
            </div>

            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Продавец
                </label>
                <select
                  value={form.soldById}
                  onChange={(e) => setForm({ ...form, soldById: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Не указан</option>
                  {salesManagers.map((sm) => (
                    <option key={sm.id} value={sm.id}>
                      {sm.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isAdmin && (
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Исторические даты</p>
                <p className="text-xs text-gray-500 mb-3">Оставьте пустым для текущей даты</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Дата создания</label>
                    <input
                      type="datetime-local"
                      value={form.createdAt}
                      onChange={(e) => setForm({ ...form, createdAt: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Дата назначения специалисту</label>
                    <input
                      type="datetime-local"
                      value={form.assignedAt}
                      onChange={(e) => setForm({ ...form, assignedAt: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Дата назначения дизайнеру</label>
                    <input
                      type="datetime-local"
                      value={form.designerAssignedAt}
                      onChange={(e) => setForm({ ...form, designerAssignedAt: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Заметки
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Дополнительная информация..."
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors text-sm"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-amber-500 text-gray-900 rounded-md hover:bg-amber-600 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {submitting ? 'Сохранение...' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
