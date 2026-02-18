'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/constants';
import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  role: string | null;
  createdAt: string;
}

const ROLES = ['ADMIN', 'SPECIALIST', 'SALES_MANAGER', 'DESIGNER', 'LEAD_DESIGNER'] as const;

export default function UsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch {
      // handled by api client
    } finally {
      setLoading(false);
    }
  }, []);

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
      fetchUsers();
    }
  }, [authLoading, user, fetchUsers, router]);

  const handleRoleChange = async (userId: string, role: string) => {
    setError('');
    try {
      await api.updateUserRole(userId, role);
      setEditingUserId(null);
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка назначения роли');
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
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-slate-400 w-64"
              placeholder="Поиск пользователей..."
              readOnly
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <button
            onClick={fetchUsers}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 transition-colors text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Обновить
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Пользователи</h1>
          <p className="text-slate-500 mt-1">Управление аккаунтами и ролями сотрудников</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4">✕</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">Загрузка...</div>
        ) : (
          <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['ФИО', 'Email', 'Роль', 'Дата регистрации', 'Действия'].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {u.fullName}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {u.email}
                    </td>
                    <td className="px-6 py-4">
                      {editingUserId === u.id ? (
                        <select
                          defaultValue={u.role || ''}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          onBlur={() => setEditingUserId(null)}
                          autoFocus
                          className="px-2 py-1.5 border border-primary/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <option value="" disabled>Выберите роль</option>
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      ) : u.role ? (
                        <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold">
                          Ожидает назначения
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-6 py-4">
                      {u.id !== user.id && editingUserId !== u.id && (
                        <button
                          onClick={() => setEditingUserId(u.id)}
                          className="text-sm text-primary hover:underline font-medium"
                        >
                          Изменить роль
                        </button>
                      )}
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
