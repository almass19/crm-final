'use client';

import { FunnelKey, RETENTION_TARGET } from '@/lib/targetologist-report';
import { useMoney } from '@/lib/privacy';
import { CELL, FACT_BG, GREY_BG, HEAD, PLAN_BG, ReportData, fmtPct, retentionBg } from './types';

type Value = number | null;

interface Row {
  label: string;
  plan: Value | 'none';
  fact: Value;
  done?: Value;
  buckets?: Value[];
  kind?: 'pct' | 'money';
  bold?: boolean;
  sub?: boolean;
}

function ratioList(a: number[], b: number[]): Value[] {
  return a.map((v, i) => (b[i] ? v / b[i] : null));
}

function buildRows(data: ReportData): Row[] {
  const s = data.summary;
  const w = (k: FunnelKey) => s.weekly[k];
  const done = (fact: number, plan: number) => (plan ? fact / plan : null);
  return [
    { label: 'Активных проектов (сейчас)', plan: s.activePlan, fact: s.active, bold: true },
    { label: '— в работе (ведение)', plan: 'none', fact: s.activeByStatus.inWork, sub: true },
    { label: '— в статусе продления', plan: 'none', fact: s.activeByStatus.renewal, sub: true },
    { label: '— на паузе', plan: 'none', fact: s.activeByStatus.paused, sub: true },
    { label: '— ещё не запущены (новый, назначен, брифинг, настройка)', plan: 'none', fact: s.activeByStatus.starting, sub: true },
    { label: 'Новых проектов взято', plan: 'none', fact: s.totals.new, buckets: w('new') },
    { label: 'Запущено (дата запуска)', plan: 'none', fact: s.totals.launched, buckets: w('launched') },
    { label: 'Подошло к продлению', plan: 'none', fact: s.totals.due, buckets: w('due') },
    { label: 'Продлили', plan: s.renewedPlan, fact: s.totals.renewed, done: done(s.totals.renewed, s.renewedPlan), buckets: w('renewed'), bold: true },
    { label: 'Ушли (не продлили)', plan: s.lostPlan, fact: s.totals.lost, buckets: w('lost') },
    { label: 'Срок прошёл, ждём оплату', plan: 'none', fact: s.totals.waiting, buckets: w('waiting') },
    { label: 'Удержание по сроку (продлили ÷ подошло)', plan: RETENTION_TARGET, fact: s.retDue, buckets: ratioList(w('renewed'), w('due')), kind: 'pct' },
    { label: 'Удержание к прошлому месяцу (как в плане)', plan: RETENTION_TARGET, fact: s.retPlan, kind: 'pct', bold: true },
    { label: 'Заработок: новые проекты', plan: 'none', fact: s.earnNew, kind: 'money' },
    { label: 'Заработок: продления', plan: 'none', fact: s.earnRenewal, kind: 'money' },
    { label: 'ЗАРАБОТОК ИТОГО', plan: s.earnPlan, fact: s.earnTotal, kind: 'money', bold: true },
  ];
}

export default function ReportFunnel({ data }: { data: ReportData }) {
  const money = useMoney();
  const show = (v: Value | 'none', kind?: Row['kind']): string => {
    if (v === 'none') return '—';
    if (kind === 'pct') return fmtPct(v);
    if (v === null) return '—';
    return kind === 'money' ? money(v) : String(v);
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <table className="min-w-full text-sm border-collapse text-slate-900">
        <thead>
          <tr>
            <th className={`${HEAD} sticky left-0 z-[1] min-w-[300px]`}>Показатель</th>
            <th className={HEAD}>План</th>
            <th className={HEAD}>Факт</th>
            <th className={HEAD}>Выполнение</th>
            {data.buckets.map((b) => (
              <th key={b.start} className={`${HEAD} whitespace-pre-line min-w-[72px]`}>{b.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {buildRows(data).map((r) => (
            <tr key={r.label} className="hover:brightness-[0.97]">
              <td className={`${CELL} sticky left-0 z-[1] ${r.sub ? 'bg-slate-50 text-slate-600 text-xs text-left pl-8' : 'bg-white text-center'} ${r.bold ? 'font-bold' : ''}`}>{r.label}</td>
              <td className={`${CELL} ${PLAN_BG} text-center`}>{show(r.plan, r.kind)}</td>
              <td className={`${CELL} ${FACT_BG} text-center font-semibold ${r.kind === 'pct' ? retentionBg(r.fact, RETENTION_TARGET) : ''}`}>
                {show(r.fact, r.kind)}
              </td>
              <td className={`${CELL} text-center ${r.done !== undefined ? 'bg-[#fff2cc]' : ''}`}>
                {r.done !== undefined ? fmtPct(r.done ?? null) : ''}
              </td>
              {data.buckets.map((b, i) => (
                <td key={b.start} className={`${CELL} text-center ${r.buckets ? FACT_BG : GREY_BG} ${r.kind === 'pct' ? 'font-semibold' : ''}`}>
                  {r.buckets ? show(r.buckets[i], r.kind) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
