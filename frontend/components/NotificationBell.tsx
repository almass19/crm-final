'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Notification } from '@/lib/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(fetchNotifications, 30000);

    const onFocus = () => fetchNotifications();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await api.markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
      );
    }
    setOpen(false);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
        title="Уведомления"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm text-gray-900">Уведомления</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Прочитать все
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              Нет уведомлений
            </div>
          ) : (
            <div>
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b last:border-b-0 ${
                    !n.isRead ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">{n.title}</div>
                  <div className="text-sm text-gray-600 mt-0.5">{n.message}</div>
                  <div className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
