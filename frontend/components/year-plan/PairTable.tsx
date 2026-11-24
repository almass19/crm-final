'use client';

import { CELL, FACT_BG, HEAD, MonthCell, PLAN_BG, TOTAL_BG, YearPlanData, doneBg, ratio } from './shared';

type Val = number | null | undefined;

/** A metric shown as a «План | Факт» pair. The fact cell is coloured by how much of the plan it reached. */
export interface PairColumn {
  label: string;
  plan: (ym: string) => Val;
  fact: (ym: string) => Val;
  planTotal: Val;
  factTotal: Val;
  fmt: (v: number) => string;
  /** Colour the fact by completion (counts, money). Off for ratios like conversion. */
  graded?: boolean;
  /** Year completion: fact over the plan of months that already have a fact. */
  doneTotal?: number | null;
  bold?: boolean;
  /** Text shown on hover over a fact cell (e.g. where the number came from). */
  factTitle?: (ym: string) => string | undefined;
}

/** A plan-only or fact-only column outside the pairs. */
export interface SingleColumn {
  label: string;
  value: (ym: string) => Val;
  total: Val;
  fmt: (v: number) => string;
  kind: 'plan' | 'fact' | 'input';
  totalTitle?: string;
}

interface PairTableProps {
  data: YearPlanData;
  before?: SingleColumn[];
  pairs: PairColumn[];
  after?: SingleColumn[];
}

const KIND_BG: Record<SingleColumn['kind'], string> = { plan: PLAN_BG, fact: FACT_BG, input: 'bg-[#fff2cc]' };
const show = (v: Val, fmt: (n: number) => string, empty: string) => (v === null || v === undefined ? empty : fmt(v));

export default function PairTable({ data, before = [], pairs, after = [] }: PairTableProps) {
  const single = (c: SingleColumn, ym: string) => (
    <td key={c.label} className={`${CELL} ${KIND_BG[c.kind]}`}>{show(c.value(ym), c.fmt, c.kind === 'fact' ? '' : '—')}</td>
  );

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <table className="min-w-full text-sm border-collapse text-slate-900">
        <thead>
          <tr>
            <th rowSpan={2} className={`${HEAD} sticky left-0 z-[1] min-w-[80px]`}>Месяц</th>
            {before.map((c) => <th key={c.label} rowSpan={2} className={`${HEAD} min-w-[80px]`}>{c.label}</th>)}
            {pairs.map((c) => <th key={c.label} colSpan={2} className={`${HEAD} border-b-white/30`}>{c.label}</th>)}
            {after.map((c) => <th key={c.label} rowSpan={2} className={`${HEAD} min-w-[80px]`}>{c.label}</th>)}
          </tr>
          <tr>
            {pairs.map((c) => [
              <th key={`${c.label}p`} className={`${HEAD} bg-[#2f4b7c] font-semibold min-w-[76px]`}>План</th>,
              <th key={`${c.label}f`} className={`${HEAD} bg-[#2f4b7c] font-semibold min-w-[76px]`}>Факт</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {data.months.map((ym) => (
            <tr key={ym}>
              <MonthCell ym={ym} currentYm={data.currentYm} />
              {before.map((c) => single(c, ym))}
              {pairs.map((c) => {
                const p = c.plan(ym);
                const f = c.fact(ym);
                const done = c.graded && p && f !== null && f !== undefined ? ratio(f, p) : null;
                return [
                  <td key={`${c.label}p`} className={`${CELL} ${PLAN_BG} ${c.bold ? 'font-bold' : ''}`}>{show(p, c.fmt, '—')}</td>,
                  <td
                    key={`${c.label}f`}
                    title={c.factTitle?.(ym)}
                    className={`${CELL} border-r-2 border-r-slate-400 ${c.bold ? 'font-bold' : ''} ${done !== null ? doneBg(done) : FACT_BG}`}
                  >
                    {show(f, c.fmt, '')}
                  </td>,
                ];
              })}
              {after.map((c) => single(c, ym))}
            </tr>
          ))}
          <tr className={TOTAL_BG}>
            <td className={`${CELL} sticky left-0 z-[1] bg-slate-100`}>{data.year}</td>
            {before.map((c) => <td key={c.label} className={CELL} title={c.totalTitle}>{show(c.total, c.fmt, '—')}</td>)}
            {pairs.map((c) => [
              <td key={`${c.label}p`} className={CELL}>{show(c.planTotal, c.fmt, '—')}</td>,
              <td key={`${c.label}f`} className={`${CELL} border-r-2 border-r-slate-400 ${c.graded ? doneBg(c.doneTotal ?? null) : ''}`}>
                {show(c.factTotal, c.fmt, '')}
              </td>,
            ])}
            {after.map((c) => <td key={c.label} className={CELL} title={c.totalTitle}>{show(c.total, c.fmt, '')}</td>)}
          </tr>
        </tbody>
      </table>
    </section>
  );
}
