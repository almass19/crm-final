'use client';

import { useEffect, useState } from 'react';
import { FUNNEL_ROWS, FunnelField, FunnelRow } from '@/lib/sales-funnel';
import { FunnelData } from './types';

interface DayFormProps {
  data: FunnelData;
  canEdit: (row: FunnelRow, day: string) => boolean;
  onSave: (field: FunnelField, day: string, value: number | null) => Promise<void>;
}

/** Quick entry for one day — the main way to fill the funnel from a phone. */
export default function DayForm({ data, canEdit, onSave }: DayFormProps) {
  const allDays = data.weeks.flatMap((w) => w.days);
  const defaultDay = allDays.includes(data.today) ? data.today : allDays[allDays.length - 1];
  const [day, setDay] = useState(defaultDay);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDay(defaultDay); }, [defaultDay]);

  const rows = FUNNEL_ROWS.filter((r) => r.source !== 'crm' && canEdit(r, day));

  useEffect(() => {
    setValues(Object.fromEntries(rows.map((r) => [r.key, shownValue(r.key)])));
    // rows derive from day + permissions; re-sync only when the day or saved data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, data.days, data.adUsd]);

  // The ad budget is typed in dollars (cents allowed); the rest are whole numbers.
  function shownValue(key: FunnelField): string {
    if (key === 'adBudget') return data.adUsd?.[day] ? String(data.adUsd[day].usd) : '';
    const v = data.days[day]?.[key];
    return v == null ? '' : String(v);
  }
  const usdEntry = data.adUsd?.[day];
  const adBudgetKzt = Number(data.days[day]?.adBudget) || 0;

  if (rows.length === 0) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      for (const r of rows) {
        const raw = (values[r.key] ?? '').trim().replace(',', '.');
        const next = raw === '' ? null : Number(raw);
        if (next !== null && !Number.isFinite(next)) continue;
        if (raw !== shownValue(r.key)) await onSave(r.key, day, next);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-bold text-slate-900">Внести за день</h2>
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {allDays.filter((d) => d <= data.today).reverse().map((d) => (
            <option key={d} value={d}>
              {new Date(`${d}T00:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short', timeZone: 'UTC' })}
              {d === data.today ? ' — сегодня' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {rows.map((r) => (
          <label key={r.key} className="block">
            <span className="block text-xs font-medium text-slate-500 mb-1">{r.key === 'adBudget' ? `${r.label}, $` : r.label}</span>
            <input
              inputMode={r.key === 'adBudget' ? 'decimal' : 'numeric'}
              value={values[r.key] ?? ''}
              placeholder={r.key === 'adBudget' ? '$' : undefined}
              onChange={(e) => setValues({ ...values, [r.key]: e.target.value.replace(r.key === 'adBudget' ? /[^\d.,]/g : /[^\d]/g, '') })}
              className="w-full px-3 py-2 bg-amber-50/70 border border-slate-200 rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white"
            />
            {r.key === 'adBudget' && (
              <span className="block mt-1 text-[11px] text-slate-500 tabular-nums">
                {usdEntry?.rate
                  ? `= ${adBudgetKzt.toLocaleString('ru-RU')} ₸ по курсу ${usdEntry.rate}`
                  : adBudgetKzt ? `${adBudgetKzt.toLocaleString('ru-RU')} ₸ (введено раньше в тенге)` : 'Переведётся в ₸ по курсу Нацбанка'}
              </span>
            )}
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">Продажи и оплата считаются сами по клиентам в CRM.</p>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
}
