'use client';

import { useState } from 'react';
import { FUNNEL_ROWS, FunnelField, FunnelRow, planFor, sumDays } from '@/lib/sales-funnel';
import { FunnelData, fmtPct } from './types';

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

interface FunnelGridProps {
  data: FunnelData;
  canEdit: (row: FunnelRow, day: string) => boolean;
  onSave: (field: FunnelField, day: string, value: number | null) => void;
}

function fmt(n: number, money?: boolean): string {
  if (!n) return '';
  return money ? Math.round(n).toLocaleString('ru-RU') : String(n);
}

function pctClass(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return 'text-slate-400';
  if (p >= 1) return 'text-emerald-600';
  if (p >= 0.7) return 'text-amber-600';
  return 'text-red-600';
}

function Cell({ value, editable, money, onCommit }: {
  value: number | null | undefined;
  editable: boolean;
  money?: boolean;
  onCommit: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (!editable) {
    return <span className="block text-right tabular-nums">{fmt(Number(value) || 0, money)}</span>;
  }
  const shown = draft ?? (value === null || value === undefined ? '' : String(value));
  const commit = () => {
    if (draft === null) return;
    const trimmed = draft.trim();
    setDraft(null);
    const next = trimmed === '' ? null : Number(trimmed);
    if (next !== null && (!Number.isInteger(next) || next < 0)) return;
    if (next !== (value ?? null)) onCommit(next);
  };
  return (
    <input
      inputMode="numeric"
      value={shown}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="w-full min-w-[3rem] bg-amber-50/70 hover:bg-amber-100 focus:bg-white rounded px-1.5 py-1 text-right tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
    />
  );
}

export default function FunnelGrid({ data, canEdit, onSave }: FunnelGridProps) {
  const plan = planFor(data.plan);
  const allDays = data.weeks.flatMap((w) => w.days);
  const fact = (key: FunnelField) => sumDays(data.days, allDays, key);
  const leadsFact = fact('leads');
  const weekCount = data.weeks.length;

  const th = 'px-2 py-2 text-xs font-bold text-slate-500 whitespace-nowrap';
  const sticky = 'sticky left-0 z-[1] bg-white';

  return (
    <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className={`${th} ${sticky} !bg-slate-50 text-left`} rowSpan={2}>Воронка</th>
              <th className={th} rowSpan={2}>План</th>
              <th className={th} rowSpan={2}>Факт</th>
              <th className={th} rowSpan={2}>Конв.</th>
              <th className={`${th} border-r border-slate-200`} rowSpan={2}>Вып.</th>
              {data.weeks.map((w) => (
                <th key={w.n} colSpan={w.days.length + 1} className={`${th} border-r border-slate-200 text-center`}>
                  Неделя {w.n}
                </th>
              ))}
            </tr>
            <tr>
              {data.weeks.map((w) => [
                ...w.days.map((d) => {
                  const date = new Date(`${d}T00:00:00Z`);
                  const isToday = d === data.today;
                  return (
                    <th key={d} className={`${th} text-center ${isToday ? 'bg-primary/10 text-primary' : ''}`}>
                      <div>{date.getUTCDate()}</div>
                      <div className="font-medium text-[10px]">{WEEKDAYS[date.getUTCDay()]}</div>
                    </th>
                  );
                }),
                <th key={`w${w.n}`} className={`${th} bg-slate-100 border-r border-slate-200`}>Итог</th>,
              ])}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {FUNNEL_ROWS.map((row) => {
              const p = plan[row.key];
              const f = fact(row.key);
              const done = p ? f / p : null;
              const conv = row.key === 'leads' || row.money || !leadsFact ? null : f / leadsFact;
              const weekPlan = p ? p / weekCount : null;
              return (
                <tr key={row.key} className="hover:bg-slate-50/60">
                  <td className={`${sticky} px-3 py-1.5 font-medium text-slate-800 whitespace-nowrap`}>
                    {row.label}
                    {row.source === 'crm' && <span className="ml-1 text-[10px] text-slate-400">из CRM</span>}
                    {row.source === 'admin' && <span className="ml-1 text-[10px] text-slate-400">рук.</span>}
                  </td>
                  <td className="px-2 text-right tabular-nums text-slate-500">{p === null ? '—' : fmt(p, row.money) || '0'}</td>
                  <td className="px-2 text-right tabular-nums font-semibold">{fmt(f, row.money) || '0'}</td>
                  <td className="px-2 text-right tabular-nums text-slate-500">{fmtPct(conv)}</td>
                  <td className={`px-2 text-right tabular-nums font-semibold border-r border-slate-200 ${pctClass(done)}`}>{fmtPct(done)}</td>
                  {data.weeks.map((w) => {
                    const wf = sumDays(data.days, w.days, row.key);
                    const wp = weekPlan ? wf / weekPlan : null;
                    return [
                      ...w.days.map((d) => (
                        <td key={d} className={`px-1 py-1 ${d === data.today ? 'bg-primary/5' : ''}`}>
                          <Cell
                            value={data.days[d]?.[row.key]}
                            editable={canEdit(row, d)}
                            money={row.money}
                            onCommit={(v) => onSave(row.key, d, v)}
                          />
                        </td>
                      )),
                      <td key={`w${w.n}`} className="px-2 bg-slate-50 border-r border-slate-200 text-right whitespace-nowrap">
                        <div className="tabular-nums font-semibold">{fmt(wf, row.money) || '0'}</div>
                        <div className={`text-[10px] ${pctClass(wp)}`}>{fmtPct(wp)}</div>
                      </td>,
                    ];
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
