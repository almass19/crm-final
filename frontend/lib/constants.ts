export const STATUS_LABELS: Record<string, string> = {
  NEW: 'Новый',
  ASSIGNED: 'Назначен',
  IN_WORK: 'В работе',
  DONE: 'Завершён',
  REJECTED: 'Отклонён',
};

export const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  ASSIGNED: 'bg-yellow-100 text-yellow-800',
  IN_WORK: 'bg-green-100 text-green-800',
  DONE: 'bg-gray-100 text-gray-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор',
  SPECIALIST: 'Специалист',
  SALES_MANAGER: 'Менеджер по продажам',
  DESIGNER: 'Дизайнер',
  LEAD_DESIGNER: 'Главный дизайнер',
};

export const SERVICE_OPTIONS = [
  'Таргетированная реклама',
  'СММ',
  'Сайт',
  'Упаковка',
  'Контекстная реклама',
];

export const TASK_STATUS_LABELS: Record<string, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  DONE: 'Завершена',
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  DONE: 'bg-green-100 text-green-800',
};
