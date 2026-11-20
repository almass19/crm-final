import type { DayValues, SalesPlan, Week } from '@/lib/sales-funnel';

export interface ManagerSummary {
  id: string;
  fullName: string;
  salesPlan: number;
  sales: number;
  payment: number;
}

export interface ManagerPlan extends SalesPlan {
  managerId: string;
}

export interface SoldClient {
  id: string;
  name: string;
  date: string;
  amount: number;
  status: string;
  managerName: string;
}

export interface Earnings {
  fix: number;
  percent: number;
  bonus: number;
  total: number;
  next: { from: number; bonus: number } | null;
}

export interface FunnelData {
  month: string;
  selected: string;
  isAdmin: boolean;
  today: string;
  weeks: Week[];
  plan: SalesPlan | null;
  managerPlans: ManagerPlan[];
  days: Record<string, DayValues>;
  managers: ManagerSummary[];
  clients: SoldClient[];
  earnings: Earnings | null;
}

export const fmtMoney = (n: number): string => `${Math.round(n).toLocaleString('ru-RU')} ₸`;
export const fmtPct = (n: number | null): string => (n === null || !Number.isFinite(n) ? '—' : `${Math.round(n * 100)}%`);
