'use client';

interface TaskPriorityBadgeProps {
  priority: number;
  showPercentage?: boolean;
}

export default function TaskPriorityBadge({
  priority,
  showPercentage = true,
}: TaskPriorityBadgeProps) {
  // Calculate fire intensity based on priority (0-100)
  // Below 30: gray/low, 30-60: orange, above 60: red/animated
  const isHigh = priority >= 70;
  const isMedium = priority >= 40 && priority < 70;
  const isLow = priority < 40;

  // Calculate opacity based on priority (0.3 to 1.0)
  const opacity = 0.3 + (priority / 100) * 0.7;

  return (
    <span className="inline-flex items-center space-x-1">
      <span
        className={`text-lg transition-all ${
          isHigh
            ? 'text-red-500 animate-pulse'
            : isMedium
            ? 'text-orange-400'
            : 'text-gray-300'
        }`}
        style={{ opacity: isLow ? opacity : 1 }}
        title={`Приоритет: ${priority}%`}
      >
        🔥
      </span>
      {showPercentage && (
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            isHigh
              ? 'bg-red-100 text-red-800'
              : isMedium
              ? 'bg-orange-100 text-orange-800'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {priority}%
        </span>
      )}
    </span>
  );
}
