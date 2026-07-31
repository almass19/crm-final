import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser, UserRole } from './supabase/auth-helpers';

// Same visibility rules as GET /api/clients/[id]/payments: DESIGNER and
// TARGETOLOGIST must never see payment records (TARGETOLOGIST only sees the
// client's deal amount, handled separately via sanitizeClient).
const ROLES_WITH_PAYMENT_ACCESS: UserRole[] = [
  'ADMIN',
  'SALES_MANAGER',
  'LEAD_DESIGNER',
];

export function canSeePayments(role: UserRole | null): boolean {
  return !!role && ROLES_WITH_PAYMENT_ACCESS.includes(role);
}

/**
 * Sums the payments of the given clients, so list views can show how much a
 * client has actually paid without opening the client card.
 *
 * The caller is responsible for passing only client ids the user is allowed to
 * see — this helper does not re-check client ownership. A SALES_MANAGER only
 * counts their own payments, mirroring the payments endpoint.
 */
export async function getPaidTotals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  clientIds: string[],
  user: AuthUser,
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (!clientIds.length || !canSeePayments(user.role)) return totals;

  let query = supabase
    .from('payments')
    .select('client_id, amount')
    .in('client_id', clientIds);

  if (user.role === 'SALES_MANAGER') {
    query = query.eq('manager_id', user.id);
  }

  const { data, error } = await query;
  if (error) throw error;

  for (const payment of data || []) {
    const current = totals.get(payment.client_id) || 0;
    totals.set(payment.client_id, current + Number(payment.amount || 0));
  }

  return totals;
}
