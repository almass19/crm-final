'use client';

import { RETENTION_TARGET } from '@/lib/targetologist-report';
import { CELL, FACT_BG, GREY_BG, HEAD, ReportData, fmtPct, retentionBg } from './types';

const COLS = [
  'Месяц входа', 'Новых проектов пришло', 'Продлили хотя бы раз', 'Удержано, % (прошло 30 дней)',
  'Оплатили 3-й месяц', '3-й месяц, % (прошло 60 дней)', 'Активны сейчас', 'Срок ещё не подошёл', 'Ушли без продления',
];

const pctOrPending = (v: number | null) => (v === null ? 'срок не подошёл' : fmtPct(v));

export default function CohortTable({ data }: { data: ReportData }) {
  const t = data.cohortTotals;
  const scope = data.selected === 'all' ? 'вся команда; по текущему таргетологу клиента' : 'по дате покупки; «удержано» = оплатил 2-й месяц';
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <h2 className="px-5 pt-4 pb-2 text-base font-bold text-slate-900">
        Новые проекты по месяцам и сколько удержано
        <span className="ml-2 text-xs font-normal text-slate-500">({scope})</span>
      </h2>
      <table className="min-w-full text-sm border-collapse text-slate-900">
        <thead>
          <tr>{COLS.map((c) => <th key={c} className={`${HEAD} max-w-[110px]`}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {data.cohorts.map((c) => (
            <tr key={c.ym}>
              <td className={`${CELL} text-center font-bold min-w-[140px]`}>{c.label}</td>
              <td className={`${CELL} ${FACT_BG} text-center`}>{c.newCount}</td>
              <td className={`${CELL} ${FACT_BG} text-center`}>{c.renewed}</td>
              <td className={`${CELL} text-center font-semibold ${retentionBg(c.ret2, RETENTION_TARGET) || FACT_BG}`}>{pctOrPending(c.ret2)}</td>
              <td className={`${CELL} ${FACT_BG} text-center`}>{c.third}</td>
              <td className={`${CELL} ${FACT_BG} text-center`}>{pctOrPending(c.ret3)}</td>
              <td className={`${CELL} ${FACT_BG} text-center`}>{c.active}</td>
              <td className={`${CELL} ${FACT_BG} text-center`}>{c.pending}</td>
              <td className={`${CELL} ${FACT_BG} text-center`}>{c.lost}</td>
            </tr>
          ))}
          <tr className={`${GREY_BG} font-bold`}>
            <td className={`${CELL} text-center`}>Итого</td>
            <td className={`${CELL} text-center`}>{t.newCount}</td>
            <td className={`${CELL} text-center`}>{t.renewed}</td>
            <td className={`${CELL} text-center ${retentionBg(t.ret2, RETENTION_TARGET)}`}>{fmtPct(t.ret2)}</td>
            <td className={`${CELL} text-center`}>{t.third}</td>
            <td className={`${CELL} text-center`}>{fmtPct(t.ret3)}</td>
            <td className={`${CELL} text-center`}>{t.active}</td>
            <td className={`${CELL} text-center`}>{t.pending}</td>
            <td className={`${CELL} text-center`}>{t.lost}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
