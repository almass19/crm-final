'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';
import TaskPriorityBadge from '@/components/TaskPriorityBadge';
import TaskStatusBadge from '@/components/TaskStatusBadge';

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  status: string;
  dueDate: string | null;
  createdAt: string;
  client: { id: string; fullName: string | null; companyName: string | null };
  creator: { id: string; fullName: string; role: string };
  assignee: { id: string; fullName: string; role: string } | null;
}

interface Client {
  id: string;
  fullName: string | null;
  companyName: string | null;
}

interface UserOption {
  id: string;
  fullName: string;
  email: string;
}

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my');
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = viewMode === 'my' ? await api.getMyTasks() : await api.getAllTasks();
      setTasks(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [user, viewMode]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (user && user.role === 'SALES_MANAGER') {
      router.replace('/clients');
      return;
    }
    if (user) {
      fetchTasks();
      api.getClients().then(setClients).catch(() => {});
      api.getUsers().then(setAllUsers).catch(() => {});
    }
  }, [authLoading, user, fetchTasks, router]);

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      await api.updateTask(taskId, { status });
      fetchTasks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setConfirmDeleteTaskId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <div className="text-slate-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <AppShell>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('my')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                viewMode === 'my' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Мои
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                viewMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Все
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <button
            onClick={fetchTasks}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 transition-colors text-slate-600"
          >
            Обновить
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-semibold shadow-sm shadow-primary/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Создать задачу
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Задачи</h1>
          <p className="text-slate-500 mt-1">Управление и отслеживание задач</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">Загрузка...</div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-500">
            {viewMode === 'my' ? 'У вас нет активных задач' : 'Нет активных задач'}
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Приоритет', 'Задача', 'Клиент', 'Статус', 'Срок', viewMode === 'all' ? 'Исполнитель' : 'Создал', 'Действия'].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <TaskPriorityBadge priority={task.priority} showPercentage={true} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">{task.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => router.push(`/clients/${task.client.id}`)}
                        className="text-sm text-primary hover:underline font-medium"
                      >
                        {task.client.fullName || task.client.companyName}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <TaskStatusBadge status={task.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ru-RU') : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {viewMode === 'all' ? task.assignee?.fullName || 'Не назначен' : task.creator.fullName}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {task.status === 'NEW' && (
                          <button
                            onClick={() => handleStatusChange(task.id, 'IN_PROGRESS')}
                            className="text-xs px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 font-semibold transition-colors"
                          >
                            Начать
                          </button>
                        )}
                        {task.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleStatusChange(task.id, 'DONE')}
                            className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-semibold transition-colors"
                          >
                            Завершить
                          </button>
                        )}
                        {user.role === 'ADMIN' && (
                          confirmDeleteTaskId === task.id ? (
                            <span className="flex items-center gap-1 text-sm">
                              <button onClick={() => handleDeleteTask(task.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Да</button>
                              <button onClick={() => setConfirmDeleteTaskId(null)} className="text-slate-400 hover:text-slate-600 text-sm">Нет</button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteTaskId(task.id)}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              Удалить
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateTaskModal
          clients={clients}
          users={allUsers}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchTasks();
          }}
        />
      )}
    </AppShell>
  );
}

function CreateTaskModal({
  clients,
  users,
  onClose,
  onCreated,
}: {
  clients: { id: string; fullName: string | null; companyName: string | null }[];
  users: { id: string; fullName: string; email: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 50,
    clientId: '',
    assigneeId: '',
    dueDate: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientList(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const filteredClients = clients.filter((c) => {
    const name = (c.fullName || c.companyName || '').toLowerCase();
    return name.includes(clientSearch.toLowerCase());
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Введите название задачи'); return; }
    if (!form.clientId) { setError('Выберите клиента'); return; }
    setError('');
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = {
        title: form.title,
        priority: form.priority,
        clientId: form.clientId,
      };
      if (form.description) data.description = form.description;
      if (form.assigneeId) data.assigneeId = form.assigneeId;
      if (form.dueDate) data.dueDate = form.dueDate;
      await api.createTask(data);
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityColor = (value: number) => {
    if (value >= 70) return 'text-red-500';
    if (value >= 40) return 'text-orange-400';
    return 'text-slate-400';
  };

  const inputCls = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";
  const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-900">Новая задача</h2>
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
            <div ref={clientDropdownRef} className="relative">
              <label className={labelCls}>Клиент *</label>
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setForm({ ...form, clientId: '' });
                  setShowClientList(true);
                }}
                onFocus={() => setShowClientList(true)}
                className={inputCls}
                placeholder="Поиск клиента..."
                autoComplete="off"
              />
              {showClientList && filteredClients.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredClients.map((c) => (
                    <li
                      key={c.id}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 text-slate-700"
                      onMouseDown={() => {
                        setForm({ ...form, clientId: c.id });
                        setClientSearch(c.fullName || c.companyName || '');
                        setShowClientList(false);
                      }}
                    >
                      {c.fullName || c.companyName}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className={labelCls}>Название *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="Название задачи" />
            </div>

            <div>
              <label className={labelCls}>Описание</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={inputCls} placeholder="Описание задачи..." />
            </div>

            <div>
              <label className={labelCls}>Приоритет</label>
              <div className="flex items-center gap-4">
                <span className={`text-xl ${getPriorityColor(form.priority)}`}>🔥</span>
                <input
                  type="range" min="0" max="100" value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}
                  className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className={`text-sm font-semibold min-w-[3rem] text-right ${getPriorityColor(form.priority)}`}>
                  {form.priority}%
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-1 px-8">
                <span>Низкий</span><span>Средний</span><span>Высокий</span>
              </div>
            </div>

            <div>
              <label className={labelCls}>Исполнитель</label>
              <select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })} className={inputCls}>
                <option value="">Не назначен</option>
                {users.map((u) => (<option key={u.id} value={u.id}>{u.fullName}</option>))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Срок выполнения</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputCls} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium">
                Отмена
              </button>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity text-sm font-semibold">
                {submitting ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
