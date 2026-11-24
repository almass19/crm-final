'use client';

import { DailyCheck, hasIssue } from '@/lib/daily-checks';

interface DailyCheckButtonProps {
  check: DailyCheck | undefined;
  onOpen: () => void;
}

/** Today's check state in the clients list; opens the check popup. */
export default function DailyCheckButton({ check, onOpen }: DailyCheckButtonProps) {
  const base = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40';

  if (!check) {
    return (
      <button type="button" onClick={onOpen} className={`${base} border border-dashed border-slate-300 text-slate-500 hover:border-primary hover:text-primary`}>
        + Отметить
      </button>
    );
  }

  if (!hasIssue(check)) {
    return (
      <button type="button" onClick={onOpen} title={check.note || 'Сегодня без замечаний'} className={`${base} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100`}>
        ✓ Ок
      </button>
    );
  }

  const issues = [check.complaint && 'Жалоба', check.slowReply && '>1 ч', check.overdue && 'Просрочка'].filter(Boolean);
  return (
    <button type="button" onClick={onOpen} title={check.note || undefined} className={`${base} bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100`}>
      ⚠ {issues.join(' · ')}
    </button>
  );
}
