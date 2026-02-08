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
      className={`inline-block px-2 py-1 text-xs font-medium rounded ${colorClass}`}
    >
      {label}
    </span>
  );
}
