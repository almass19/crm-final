'use client';

import { useState } from 'react';
import { ManagerPlan, ManagerSummary } from './types';

interface PlanModalProps {
  month: string;
  managers: ManagerSummary[];
  plans: ManagerPlan[];
  onSave: (plan: ManagerPlan) => Promise<void>;
  onClose: () => void;
}

const FIELDS: { key: keyof Omit<ManagerPlan, 'managerId'>; label: string }[] = [
  { key: 'leadsPlan', label: 'Заявки' },
  { key: 'salesPlan', label: 'Продажи' },
  { key: 'avgCheck', label: 'Средний чек, ₸' },
  { key: 'adBudgetPlan', label: 'Рекл. бюджет, ₸' },
];

/** Admin sets the month plan per sales manager; other plan rows derive from leads. */
export default function PlanModal({ month, managers, plans, onSave, onClose }: PlanModalProps) {
  const [rows, setRows] = useState<ManagerPlan[]>(() =>
    managers.map((m) => plans.find((p) => p.managerId === m.id)
      ?? { managerId: m.id, leadsPlan: 0, salesPlan: 0, avgCheck: 80000, adBudgetPlan: 0 }),
  );
  const [saving, setSaving] = useState(false);

  const update = (i: number, key: keyof ManagerPlan, raw: string) => {
    const value = Number(raw.replace(/[^\d]/g, '')) || 0;
    setRows(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const r of rows) await onSave(r);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">План ОП на {month}</h2>
          <p className="text-xs text-slate-500 mt-1">ЦА, звонки, реквизиты и договоры считаются от заявок: 40% / 25% / 15% / 15% / 10%.</p>
        </div>
        <div className="p-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs font-bold text-slate-500 pb-2 pr-3">Менеджер</th>
                {FIELDS.map((f) => <th key={f.key} className="text-left text-xs font-bold text-slate-500 pb-2 px-1">{f.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.managerId}>
                  <td className="pr-3 py-1 whitespace-nowrap font-medium text-slate-800">
                    {managers.find((m) => m.id === r.managerId)?.fullName}
                  </td>
                  {FIELDS.map((f) => (
                    <td key={f.key} className="px-1 py-1">
                      <input
                        inputMode="numeric"
                        value={r[f.key] ? String(r[f.key]) : ''}
                        onChange={(e) => update(i, f.key, e.target.value)}
                        className="w-28 px-2 py-1.5 border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Отмена</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? 'Сохраняю…' : 'Сохранить план'}
          </button>
        </div>
      </div>
    </div>
  );
}
