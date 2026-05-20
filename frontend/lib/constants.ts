export const STATUS_LABELS: Record<string, string> = {
  NEW: 'Новый',
  ASSIGNED: 'Назначен',
  ONBOARDING: 'Брифинг',
  SETUP: 'Настройка',
  IN_WORK: 'Ведение',
  PAUSED: 'На паузе',
  RENEWAL: 'В процессе продления',
  DONE: 'Завершён',
};

export const STATUS_COLORS: Record<string, string> = {
  NEW:        'bg-primary-100 text-primary-600 ring-1 ring-primary-200',
  ASSIGNED:   'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  ONBOARDING: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  SETUP:      'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  IN_WORK:    'bg-success-light text-success-text ring-1 ring-green-200',
  PAUSED:     'bg-warning-light text-warning-text ring-1 ring-amber-200',
  RENEWAL:    'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  DONE:       'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Руководитель',
  TARGETOLOGIST: 'Таргетолог',
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

export const CLIENT_TYPE_LABELS: Record<string, string> = {
  LEGAL: 'Юр. лицо',
  INDIVIDUAL: 'Физ. лицо',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  DONE: 'Завершена',
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  NEW:         'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  IN_PROGRESS: 'bg-warning-light text-warning-text ring-1 ring-amber-200',
  DONE:        'bg-success-light text-success-text ring-1 ring-green-200',
};
