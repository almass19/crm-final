'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import Navbar from '@/components/Navbar';
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Новости</h1>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Создать публикацию
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : publications.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Публикаций пока нет</div>
        ) : (
          <div className="space-y-4">
            {publications.map((pub) => (
              <div key={pub.id} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">{pub.title}</h2>
                  {isAdmin && pub.authorId === user.id && (
                    <button
                      onClick={() => handleDelete(pub.id)}
                      className="text-sm text-red-500 hover:text-red-700 ml-4"
                    >
                      Удалить
                    </button>
                  )}
                </div>
                <p className="mt-2 text-gray-700 whitespace-pre-wrap">{pub.content}</p>
                <div className="mt-4 flex items-center text-sm text-gray-500">
                  <span>
                    {pub.author?.fullName || 'Неизвестный'}
                    {pub.author?.role && (
                      <span className="ml-1 text-gray-400">
                        ({ROLE_LABELS[pub.author.role] || pub.author.role})
                      </span>
                    )}
                  </span>
                  <span className="mx-2">&middot;</span>
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
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Новая публикация</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Заголовок
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Заголовок публикации"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Содержание
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Текст публикации..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setTitle('');
                  setContent('');
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !title.trim() || !content.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {submitting ? 'Публикация...' : 'Опубликовать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
