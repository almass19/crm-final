'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { CREATIVE_TYPE_LABELS } from '@/lib/constants';
import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';

interface UserOption {
  id: string;
  fullName: string;
}

interface Assignment {
  type: string;
  designerId: string | null;
  designer: { id: string; fullName: string } | null;
}

const CREATIVE_TYPES = Object.keys(CREATIVE_TYPE_LABELS);

export default function CreativeRoutingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [designers, setDesigners] = useState<UserOption[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [designerList, leadDesignerList, assignmentList] = await Promise.all([
        api.getUsers('designer'),
        api.getUsers('lead_designer'),
        api.getCreativeTypeAssignments(),
      ]);
      setDesigners([...designerList, ...leadDesignerList]);
      const byType: Record<string, Assignment> = {};
      for (const a of assignmentList as Assignment[]) byType[a.type] = a;
      setAssignments(byType);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (user && user.role !== 'ADMIN' && user.role !== 'LEAD_DESIGNER') {
      router.replace('/clients');
      return;
    }
    if (user) fetchData();
  }, [authLoading, user, fetchData, router]);

  const handleAssign = async (type: string, designerId: string) => {
    if (!designerId) return;
    setSavingType(type);
    setError('');
    try {
      const updated = await api.updateCreativeTypeAssignment(type, designerId);
      setAssignments((prev) => ({ ...prev, [type]: updated }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSavingType(null);
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
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 sm:px-6 md:px-8 py-3 md:py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div />
        <NotificationBell />
      </div>

      <div className="p-4 sm:p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Типы креативов</h1>
          <p className="text-slate-500 mt-1">
            Кто отвечает за каждый тип — именно ему бот в Telegram будет отправлять заявки
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">Загрузка...</div>
        ) : designers.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">
            Нет ни одного дизайнера — сначала назначьте роль «Дизайнер» в разделе «Пользователи»
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    {['Тип креатива', 'Ответственный дизайнер'].map((h) => (
                      <th key={h} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {CREATIVE_TYPES.map((type) => (
                    <tr key={type} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {CREATIVE_TYPE_LABELS[type]}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={assignments[type]?.designerId || ''}
                          onChange={(e) => handleAssign(type, e.target.value)}
                          disabled={savingType === type}
                          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-slate-700 disabled:opacity-50"
                        >
                          <option value="" disabled>Не назначен</option>
                          {designers.map((d) => (
                            <option key={d.id} value={d.id}>{d.fullName}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
