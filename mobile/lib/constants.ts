export const COLORS = {
  primary: '#197fe6',
  primaryLight: '#dbeafe',
  primaryDark: '#1558a8',
  primaryBg: '#eff6ff',

  success: '#16a34a',
  successLight: '#dcfce7',
  successText: '#15803d',

  warning: '#d97706',
  warningLight: '#fef3c7',
  warningText: '#b45309',

  danger: '#dc2626',
  dangerLight: '#fee2e2',
  dangerText: '#b91c1c',

  sidebar: '#0f172a',
  sidebarHover: '#1e293b',

  text: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',

  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',

  purple: '#7c3aed',
  purpleLight: '#ede9fe',
  purpleText: '#6d28d9',

  sky: '#0284c7',
  skyLight: '#e0f2fe',
  skyText: '#0369a1',

  indigo: '#4338ca',
  indigoLight: '#e0e7ff',
  indigoText: '#3730a3',
};

export const STATUS_LABELS: Record<string, string> = {
  NEW: 'Новый',
  ASSIGNED: 'Назначен',
  ONBOARDING: 'Брифинг',
  SETUP: 'Настройка',
  IN_WORK: 'Ведение',
  PAUSED: 'На паузе',
  RENEWAL: 'Продление',
  DONE: 'Завершён',
  REJECTED: 'Отклонён',
};

export const STATUS_BG: Record<string, string> = {
  NEW: '#eff6ff',
  ASSIGNED: '#eff6ff',
  ONBOARDING: '#e0f2fe',
  SETUP: '#e0e7ff',
  IN_WORK: '#dcfce7',
  PAUSED: '#fef3c7',
  RENEWAL: '#ede9fe',
  DONE: '#f1f5f9',
  REJECTED: '#fee2e2',
};

export const STATUS_TEXT: Record<string, string> = {
  NEW: '#1d4ed8',
  ASSIGNED: '#1d4ed8',
  ONBOARDING: '#0369a1',
  SETUP: '#3730a3',
  IN_WORK: '#15803d',
  PAUSED: '#b45309',
  RENEWAL: '#6d28d9',
  DONE: '#475569',
  REJECTED: '#b91c1c',
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Руководитель',
  TARGETOLOGIST: 'Таргетолог',
  SALES_MANAGER: 'Менеджер по продажам',
  DESIGNER: 'Дизайнер',
  LEAD_DESIGNER: 'Гл. дизайнер',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  DONE: 'Завершена',
};

export const TASK_STATUS_BG: Record<string, string> = {
  NEW: '#f1f5f9',
  IN_PROGRESS: '#fef3c7',
  DONE: '#dcfce7',
};

export const TASK_STATUS_TEXT: Record<string, string> = {
  NEW: '#475569',
  IN_PROGRESS: '#b45309',
  DONE: '#15803d',
};

export const PRIORITY_LABEL: Record<number, string> = {
  1: 'Низкий',
  2: 'Средний',
  3: 'Высокий',
  4: 'Критичный',
};

export const PRIORITY_COLOR: Record<number, string> = {
  1: '#16a34a',
  2: '#2563eb',
  3: '#d97706',
  4: '#dc2626',
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
