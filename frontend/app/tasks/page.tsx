'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import Navbar from '@/components/Navbar';
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

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">Задачи</h1>
            <div className="flex bg-gray-200 rounded-md">
              <button
                onClick={() => setViewMode('my')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === 'my'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Мои
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Все
              </button>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchTasks}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
            >
              Обновить
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              + Создать задачу
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Загрузка...</div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
            {viewMode === 'my' ? 'У вас нет активных задач' : 'Нет активных задач'}
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Приоритет
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Задача
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Клиент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Срок
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {viewMode === 'all' ? 'Исполнитель' : 'Создал'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <TaskPriorityBadge priority={task.priority} showPercentage={true} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {task.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => router.push(`/clients/${task.client.id}`)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        {task.client.fullName || task.client.companyName}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <TaskStatusBadge status={task.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString('ru-RU')
                        : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {viewMode === 'all'
                        ? task.assignee?.fullName || 'Не назначен'
                        : task.creator.fullName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        {task.status === 'NEW' && (
                          <button
                            onClick={() => handleStatusChange(task.id, 'IN_PROGRESS')}
                            className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                          >
                            Начать
                          </button>
                        )}
                        {task.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleStatusChange(task.id, 'DONE')}
                            className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200"
                          >
                            Завершить
                          </button>
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
    </div>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Введите название задачи');
      return;
    }
    if (!form.clientId) {
      setError('Выберите клиента');
      return;
    }
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

  // Get priority color based on value
  const getPriorityColor = (value: number) => {
    if (value >= 70) return 'text-red-500';
    if (value >= 40) return 'text-orange-400';
    return 'text-gray-400';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Новая задача</h2>
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
                Клиент *
              </label>
              <select
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Выберите клиента</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName || c.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Название задачи"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Описание
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Описание задачи..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Приоритет
              </label>
              <div className="flex items-center space-x-4">
                <span className={`text-2xl ${getPriorityColor(form.priority)}`}>
                  🔥
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <span className={`text-sm font-medium min-w-[3rem] text-right ${getPriorityColor(form.priority)}`}>
                  {form.priority}%
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1 px-8">
                <span>Низкий</span>
                <span>Средний</span>
                <span>Высокий</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Исполнитель
              </label>
              <select
                value={form.assigneeId}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Не назначен</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Срок выполнения
              </label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {submitting ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
