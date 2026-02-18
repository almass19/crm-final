'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';
import { Publication } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Админ',
  SPECIALIST: 'Специалист',
  SALES_MANAGER: 'Менеджер',
  DESIGNER: 'Дизайнер',
  LEAD_DESIGNER: 'Лид-дизайнер',
};

export default function NewsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPublications = useCallback(async () => {
    try {
      const data = await api.getPublications();
      setPublications(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    fetchPublications();
  }, [user, authLoading, router, fetchPublications]);

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      const pub = await api.createPublication({ title, content });
      setPublications((prev) => [pub, ...prev]);
      setTitle('');
      setContent('');
      setShowModal(false);
    } catch {
      alert('Ошибка при создании публикации');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить публикацию?')) return;
    try {
      await api.deletePublication(id);
      setPublications((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert('Ошибка при удалении');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN';

  return (
    <AppShell>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div />
        <div className="flex items-center gap-3">
          <NotificationBell />
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-semibold shadow-sm shadow-primary/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Создать публикацию
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Новости</h1>
          <p className="text-slate-500 mt-1">Публикации и объявления для команды</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : publications.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-500">
            Публикаций пока нет
          </div>
        ) : (
          <div className="space-y-4">
            {publications.map((pub) => (
              <div key={pub.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-bold text-slate-900">{pub.title}</h2>
                  {isAdmin && pub.authorId === user.id && (
                    <button
                      onClick={() => handleDelete(pub.id)}
                      className="text-sm text-red-500 hover:text-red-700 flex-shrink-0 font-medium"
                    >
                      Удалить
                    </button>
                  )}
                </div>
                <p className="mt-3 text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{pub.content}</p>
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center text-xs text-slate-500 gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                    {pub.author?.fullName?.[0] || '?'}
                  </div>
                  <span className="font-medium text-slate-700">{pub.author?.fullName || 'Неизвестный'}</span>
                  {pub.author?.role && (
                    <span className="text-slate-400">({ROLE_LABELS[pub.author.role] || pub.author.role})</span>
                  )}
                  <span className="text-slate-300">·</span>
                  <span>{new Date(pub.createdAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Новая публикация</h3>
              <button
                onClick={() => { setShowModal(false); setTitle(''); setContent(''); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Заголовок</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  placeholder="Заголовок публикации"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Содержание</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none"
                  placeholder="Текст публикации..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); setTitle(''); setContent(''); }}
                className="px-4 py-2 text-sm text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !title.trim() || !content.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-semibold transition-opacity"
              >
                {submitting ? 'Публикация...' : 'Опубликовать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
