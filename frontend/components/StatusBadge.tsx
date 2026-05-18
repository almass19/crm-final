import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants';

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full tracking-wide ${
        STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
