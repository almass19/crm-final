'use client';

import { RETENTION_TARGET } from '@/lib/targetologist-report';
import { CELL, HEAD, PersonRow, fmtPct, retentionBg } from './types';

const COLS = ['Таргетолог', 'Активных', 'В работе', 'Продление', 'Пауза', 'Новых', 'Подошло к продлению', 'Продлили', 'Ушли', 'Удержание по сроку', 'Жалобы', 'Ответ > 1 ч', 'Просрочки'];

interface RankingProps {
  people: PersonRow[];
  onPick: (id: string) => void;
}

export default function Ranking({ people, onPick }: RankingProps) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <h2 className="px-5 pt-4 pb-2 text-base font-bold text-slate-900">Рейтинг таргетологов</h2>
      <table className="min-w-full text-sm border-collapse text-slate-900">
        <thead>
          <tr>{COLS.map((c) => <th key={c} className={HEAD}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr
              key={p.id}
              tabIndex={0}
              onClick={() => onPick(p.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') onPick(p.id); }}
              className="cursor-pointer hover:bg-slate-50 focus:outline-none focus:bg-primary/5"
              title="Открыть отчёт таргетолога"
            >
              <td className={`${CELL} text-center font-bold min-w-[220px]`}>{p.name}</td>
              <td className={`${CELL} text-center font-semibold`}>{p.active}</td>
              <td className={`${CELL} text-center text-slate-600`}>{p.inWork}</td>
              <td className={`${CELL} text-center text-slate-600`}>{p.renewal}</td>
              <td className={`${CELL} text-center text-slate-600`}>{p.paused}</td>
              <td className={`${CELL} text-center`}>{p.newCount}</td>
              <td className={`${CELL} text-center`}>{p.due}</td>
              <td className={`${CELL} text-center`}>{p.renewed}</td>
              <td className={`${CELL} text-center`}>{p.lost}</td>
              <td className={`${CELL} text-center font-semibold ${retentionBg(p.retDue, RETENTION_TARGET)}`}>{fmtPct(p.retDue)}</td>
              {[p.complaints, p.slowReplies, p.overdue].map((v, i) => (
                <td key={i} className={`${CELL} text-center ${v ? 'bg-[#ffc7ce] text-red-800 font-semibold' : ''}`}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
