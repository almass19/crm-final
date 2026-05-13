'use client';

import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '@/lib/constants';

interface TaskStatusBadgeProps {
  status: string;
}

export default function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const colorClass = TASK_STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
  const label = TASK_STATUS_LABELS[status] || status;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-full tracking-wide ${colorClass}`}
    >
      {label}
    </span>
  );
}
