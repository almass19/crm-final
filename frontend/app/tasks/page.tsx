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
  role?: string;
}

const STATUS_GROUPS = [
  { key: 'NEW', label: 'Новые' },
  { key: 'IN_PROGRESS', label: 'В работе' },
  { key: 'DONE', label: 'Завершённые' },
];

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<UserOption[]>([]);
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my');
  const [showDone, setShowDone] = useState(false);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'LEAD_DESIGNER';

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
    if (!authLoading && !user) { router.replace('/login'); return; }
    if (user?.role === 'SALES_MANAGER') { router.replace('/clients'); return; }
    if (!user) return;

    fetchTasks();
    api.getClients().then(setClients).catch(() => {});

    // Load assignee options based on role
    if (user.role === 'TARGETOLOGIST') {
      Promise.allSettled([api.getUsers('designer'), api.getUsers('lead_designer')])
        .then((results) => {
          const designers = results
            .filter((r): r is PromiseFulfilledResult<UserOption[]> => r.status === 'fulfilled')
            .flatMap((r) => r.value);
          setAssigneeOptions([{ id: user.id, fullName: user.fullName + ' (я)', role: 'TARGETOLOGIST' }, ...designers]);
        });
    } else {
      api.getUsers().then(setAssigneeOptions).catch(() => {});
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

  const visibleTasks = showDone ? tasks : tasks.filter((t) => t.status !== 'DONE');
  const tasksByStatus = STATUS_GROUPS.map(({ key, label }) => ({
    key, label,
    tasks: visibleTasks.filter((t) => t.status === key),
    total: tasks.filter((t) => t.status === key).length,
  })).filter(({ key, tasks: g }) => key !== 'DONE' ? g.length > 0 : showDone && g.length > 0);

  const doneCount = tasks.filter((t) => t.status === 'DONE').length;
  const totalActive = tasks.filter((t) => t.status !== 'DONE').length;

  return (
    <AppShell>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('my')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${viewMode === 'my' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Мои
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${viewMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Все
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <button
            onClick={fetchTasks}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 transition-colors text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
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

      <div className="p-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Задачи</h1>
            <p className="text-slate-500 mt-1">
              {loading ? 'Загрузка...' : `${totalActive} активных задач`}
            </p>
          </div>
          {doneCount > 0 && (
            <button
              onClick={() => setShowDone((v) => !v)}
              className="text-sm text-slate-500 hover:text-primary transition-colors font-medium"
            >
              {showDone ? 'Скрыть завершённые' : `Показать завершённые (${doneCount})`}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-400">Загрузка...</div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <p className="font-semibold text-slate-700 mb-1">Нет активных задач</p>
            <p className="text-sm text-slate-400">Создайте первую задачу, нажав кнопку выше</p>
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Приоритет', 'Задача', 'Клиент', 'Статус', 'Срок', viewMode === 'all' ? 'Исполнитель' : 'Создал', 'Действия'].map((h) => (
                    <th key={h} className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {tasksByStatus.map(({ key, label, tasks: group, total }) => (
                  group.length === 0 ? null : (
                    <>
                      <tr key={`group-${key}`}>
                        <td colSpan={7} className="px-6 py-2 bg-slate-50 border-y border-slate-100">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                          <span className="ml-2 text-xs text-slate-400">{total}</span>
                        </td>
                      </tr>
                      {group.map((task) => (
                        <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <TaskPriorityBadge priority={task.priority} showPercentage={false} />
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                            {task.description && (
                              <div className="text-xs text-slate-400 truncate mt-0.5">{task.description}</div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => router.push(`/clients/${task.client.id}`)}
                              className="text-sm text-primary hover:underline font-medium whitespace-nowrap"
                            >
                              {task.client.companyName || task.client.fullName}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <TaskStatusBadge status={task.status} />
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap">
                            {task.dueDate ? (
                              <span className={isOverdue(task.dueDate) && task.status !== 'DONE' ? 'text-red-500 font-semibold' : 'text-slate-500'}>
                                {new Date(task.dueDate).toLocaleDateString('ru-RU')}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                            {viewMode === 'all' ? (task.assignee?.fullName || '—') : task.creator.fullName}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {task.status === 'NEW' && (
                                <button
                                  onClick={() => handleStatusChange(task.id, 'IN_PROGRESS')}
                                  className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 font-semibold transition-colors whitespace-nowrap"
                                >
                                  Начать
                                </button>
                              )}
                              {task.status === 'IN_PROGRESS' && (
                                <button
                                  onClick={() => handleStatusChange(task.id, 'DONE')}
                                  className="text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 font-semibold transition-colors whitespace-nowrap"
                                >
                                  Завершить
                                </button>
                              )}
                              {user.role === 'ADMIN' && (
                                confirmDeleteTaskId === task.id ? (
                                  <span className="flex items-center gap-1.5 text-sm">
                                    <button onClick={() => handleDeleteTask(task.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs">Да</button>
                                    <span className="text-slate-300">|</span>
                                    <button onClick={() => setConfirmDeleteTaskId(null)} className="text-slate-400 hover:text-slate-600 text-xs">Нет</button>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteTaskId(task.id)}
                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                    title="Удалить"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateTaskModal
          clients={clients}
          assigneeOptions={assigneeOptions}
          defaultAssigneeId={user.role === 'TARGETOLOGIST' ? user.id : ''}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchTasks(); }}
        />
      )}
    </AppShell>
  );
}

function CreateTaskModal({
  clients,
  assigneeOptions,
  defaultAssigneeId,
  onClose,
  onCreated,
}: {
  clients: Client[];
  assigneeOptions: UserOption[];
  defaultAssigneeId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 50,
    clientId: '',
    assigneeId: defaultAssigneeId,
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

  const filteredClients = clients.filter((c) =>
    (c.fullName || c.companyName || '').toLowerCase().includes(clientSearch.toLowerCase())
  );

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
    if (value >= 40) return 'text-amber-500';
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
            {/* Client search */}
            <div ref={clientDropdownRef} className="relative">
              <label className={labelCls}>Клиент *</label>
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setForm({ ...form, clientId: '' }); setShowClientList(true); }}
                onFocus={() => setShowClientList(true)}
                className={inputCls}
                placeholder="Поиск клиента..."
                autoComplete="off"
              />
              {form.clientId && (
                <div className="absolute right-3 top-[2.6rem] text-green-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              )}
              {showClientList && filteredClients.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredClients.map((c) => (
                    <li
                      key={c.id}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 text-slate-700"
                      onMouseDown={() => { setForm({ ...form, clientId: c.id }); setClientSearch(c.companyName || c.fullName || ''); setShowClientList(false); }}
                    >
                      {c.companyName || c.fullName}
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
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={inputCls} placeholder="Описание задачи..." />
            </div>

            {/* Priority slider */}
            <div>
              <label className={labelCls}>Приоритет</label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min="0" max="100" value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}
                  className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className={`text-sm font-bold min-w-[2.5rem] text-right ${getPriorityColor(form.priority)}`}>
                  {form.priority}%
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Низкий</span><span>Высокий</span>
              </div>
            </div>

            {/* Assignee */}
            <div>
              <label className={labelCls}>Исполнитель</label>
              <select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })} className={inputCls}>
                <option value="">Не назначен</option>
                {assigneeOptions.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
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
