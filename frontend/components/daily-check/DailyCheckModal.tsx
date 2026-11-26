'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { CHECK_FLAGS, CheckFlag, DailyCheck, NOTE_MAX_LENGTH, almatyToday } from '@/lib/daily-checks';

interface DailyCheckModalProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSaved: (check: DailyCheck) => void;
}

type Answers = Record<CheckFlag, boolean | null>;
const EMPTY: Answers = { complaint: null, slowReply: null, overdue: null };

function fmtDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

function YesNo({ value, onChange, label }: { value: boolean | null; onChange: (v: boolean) => void; label: string }) {
  const btn = (v: boolean, text: string, active: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      aria-pressed={value === v}
      className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
        value === v ? active : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {text}
    </button>
  );
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-800">{label}</span>
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 flex-shrink-0" role="group" aria-label={label}>
        {btn(true, 'Да', 'bg-red-500 text-white')}
        {btn(false, 'Нет', 'bg-emerald-500 text-white')}
      </div>
    </div>
  );
}

export default function DailyCheckModal({ clientId, clientName, onClose, onSaved }: DailyCheckModalProps) {
  const today = almatyToday();
  const [day, setDay] = useState(today);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [note, setNote] = useState('');
  const [recent, setRecent] = useState<DailyCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getClientDailyCheck(clientId, day)
      .then((res: { check: DailyCheck | null; recent: DailyCheck[] }) => {
        if (cancelled) return;
        setAnswers(res.check ? { complaint: res.check.complaint, slowReply: res.check.slowReply, overdue: res.check.overdue } : EMPTY);
        setNote(res.check?.note || '');
        setRecent(res.recent);
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : 'Ошибка загрузки'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [clientId, day]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const complete = CHECK_FLAGS.every((f) => answers[f.key] !== null);

  const save = async () => {
    if (!complete) {
      setError('Отметьте «да» или «нет» по каждому пункту');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.saveClientDailyCheck(clientId, {
        day,
        complaint: answers.complaint as boolean,
        slowReply: answers.slowReply as boolean,
        overdue: answers.overdue as boolean,
        note: note.trim() || null,
      });
      onSaved(res.check);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-check-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl outline-none max-h-[90vh] overflow-y-auto"
      >
        <div className="px-6 pt-5 pb-3 border-b border-slate-100">
          <h2 id="daily-check-title" className="text-lg font-bold text-slate-900">Контроль за день</h2>
          <p className="text-sm text-slate-500 truncate" title={clientName}>{clientName}</p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <label className="flex items-center justify-between gap-4 text-sm text-slate-700">
            Дата
            <input
              type="date"
              value={day}
              max={today}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <div className={`transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
            {CHECK_FLAGS.map((f) => (
              <YesNo key={f.key} label={f.label} value={answers[f.key]} onChange={(v) => setAnswers({ ...answers, [f.key]: v })} />
            ))}
          </div>

          <label className="block text-sm text-slate-700">
            Примечание
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX_LENGTH))}
              rows={3}
              placeholder="Что случилось, что сделали"
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
            />
            <span className="block mt-1 text-xs text-slate-500">Примечание сразу придёт таргетологу клиента — в CRM и в Telegram.</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {recent.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Последние отметки</h3>
              <ul className="space-y-1">
                {recent.map((c) => {
                  const issues = CHECK_FLAGS.filter((f) => c[f.key]).map((f) => f.label);
                  return (
                    <li key={c.day}>
                      <button
                        type="button"
                        onClick={() => setDay(c.day)}
                        className={`w-full text-left flex gap-3 text-xs px-2 py-1 rounded hover:bg-slate-50 ${c.day === day ? 'bg-primary/5' : ''}`}
                      >
                        <span className="tabular-nums text-slate-500 w-14 flex-shrink-0">{fmtDay(c.day)}</span>
                        <span className={issues.length ? 'text-red-600' : 'text-emerald-600'}>
                          {issues.length ? issues.join(', ') : 'Всё в порядке'}
                          {c.note && <span className="text-slate-500"> — {c.note}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-100">
            Отмена
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
