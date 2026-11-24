// Daily project-manager check of a client: was there a complaint today, a
// reply slower than 1 hour, an overdue report/deadline — plus a note.
// Filled by an admin from the clients list; counted in «Аналитика таргета».

export const CHECK_FLAGS = [
  { key: 'complaint', column: 'complaint', label: 'Жалоба клиента' },
  { key: 'slowReply', column: 'slow_reply', label: 'Ответ клиенту дольше 1 часа' },
  { key: 'overdue', column: 'overdue', label: 'Просрочен отчёт / дедлайн' },
] as const;
export type CheckFlag = typeof CHECK_FLAGS[number]['key'];

export const NOTE_MAX_LENGTH = 2000;

export interface DailyCheck {
  clientId: string;
  day: string; // YYYY-MM-DD
  complaint: boolean;
  slowReply: boolean;
  overdue: boolean;
  note: string | null;
  updatedAt?: string;
}

export interface DailyCheckRow {
  client_id: string;
  day: string;
  complaint: boolean;
  slow_reply: boolean;
  overdue: boolean;
  note: string | null;
  updated_at?: string;
}

export function fromRow(r: DailyCheckRow): DailyCheck {
  return {
    clientId: r.client_id,
    day: r.day,
    complaint: r.complaint,
    slowReply: r.slow_reply,
    overdue: r.overdue,
    note: r.note,
    updatedAt: r.updated_at,
  };
}

export function isValidDay(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const ALMATY_OFFSET_MS = 5 * 3_600_000;
export function almatyToday(): string {
  return new Date(Date.now() + ALMATY_OFFSET_MS).toISOString().slice(0, 10);
}

export function hasIssue(c: Pick<DailyCheck, CheckFlag>): boolean {
  return c.complaint || c.slowReply || c.overdue;
}
