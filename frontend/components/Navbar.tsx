'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/constants';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav className="bg-gray-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-amber-400">
              CRM
            </Link>
            <Link
              href="/clients"
              className="text-gray-300 hover:text-amber-400 transition-colors"
            >
              Клиенты
            </Link>
            <Link
              href="/news"
              className="text-gray-300 hover:text-amber-400 transition-colors"
            >
              Новости
            </Link>
            {user.role !== 'SALES_MANAGER' && (
              <Link
                href="/tasks"
                className="text-gray-300 hover:text-amber-400 transition-colors"
              >
                Задачи
              </Link>
            )}
            {['ADMIN', 'SPECIALIST'].includes(user.role || '') && (
              <Link
                href="/renewals"
                className="text-gray-300 hover:text-amber-400 transition-colors"
              >
                Продлеваемые
              </Link>
            )}
            {['SPECIALIST', 'DESIGNER', 'SALES_MANAGER', 'LEAD_DESIGNER'].includes(user.role || '') && (
              <Link
                href="/dashboard"
                className="text-gray-300 hover:text-amber-400 transition-colors"
              >
                Мой дашборд
              </Link>
            )}
            {user.role === 'ADMIN' && (
              <>
                <Link
                  href="/admin-dashboard"
                  className="text-gray-300 hover:text-amber-400 transition-colors"
                >
                  Дашборды
                </Link>
                <Link
                  href="/users"
                  className="text-gray-300 hover:text-amber-400 transition-colors"
                >
                  Пользователи
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <NotificationBell />
            <div className="text-sm text-gray-400">
              {user.fullName}
              <span className="ml-2 px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs">
                {user.role ? ROLE_LABELS[user.role] : 'Без роли'}
              </span>
            </div>
            <button
              onClick={logout}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
