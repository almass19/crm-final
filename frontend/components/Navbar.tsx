'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/constants';

export default function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-gray-900">
              CRM
            </Link>
            <Link
              href="/clients"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Клиенты
            </Link>
            <Link
              href="/tasks"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Задачи
            </Link>
            {['SPECIALIST', 'DESIGNER', 'SALES_MANAGER'].includes(user.role || '') && (
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Мой дашборд
              </Link>
            )}
            {user.role === 'ADMIN' && (
              <>
                <Link
                  href="/admin-dashboard"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Дашборды
                </Link>
                <Link
                  href="/users"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Пользователи
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              {user.fullName}
              <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">
                {user.role ? ROLE_LABELS[user.role] : 'Без роли'}
              </span>
            </div>
            <button
              onClick={logout}
              className="text-sm text-red-600 hover:text-red-800 transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
