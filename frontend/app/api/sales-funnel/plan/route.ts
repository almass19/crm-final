import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { isValidMonth } from '@/lib/sales-funnel';

const MAX_VALUE = 1_000_000_000;
const FIELDS = ['leadsPlan', 'salesPlan', 'avgCheck', 'adBudgetPlan'] as const;

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_VALUE;
}

/** PUT /api/sales-funnel/plan  { month, managerId, leadsPlan, salesPlan, avgCheck, adBudgetPlan } — admin only. */
export async function PUT(request: NextRequest) {
  try {
    await requireRoles('ADMIN');
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || !isValidMonth(body.month as string) || typeof body.managerId !== 'string') {
      return NextResponse.json({ message: 'Некорректный месяц или менеджер' }, { status: 400 });
    }
    if (!FIELDS.every((f) => isCount(body[f]))) {
      return NextResponse.json({ message: 'План: только целые числа от 0' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.from('sales_plans').upsert(
      {
        month: body.month,
        manager_id: body.managerId,
        leads_plan: body.leadsPlan,
        sales_plan: body.salesPlan,
        avg_check: body.avgCheck,
        ad_budget_plan: body.adBudgetPlan,
      },
      { onConflict: 'month,manager_id' },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Не удалось сохранить план' }, { status: 500 });
  }
}
