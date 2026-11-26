import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import {
  ADMIN_ONLY_FIELDS, FIELD_TO_COLUMN, FUNNEL_INPUT_FIELDS, FunnelInputField, isValidDay,
} from '@/lib/sales-funnel';
import { fetchUsdRate } from '@/lib/usd-rate';

const MAX_VALUE = 1_000_000_000;

/**
 * PUT /api/sales-funnel/day  { managerId, day, field, value }
 * Saves one cell. A sales manager writes only their own days and not the
 * admin-only fields (leads, ad budget); an admin writes anyone's cells.
 * adBudget comes in USD (up to cents) and is stored in KZT at the National
 * Bank rate of that day, with the USD amount and rate kept alongside.
 * value null clears the cell.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireRoles('ADMIN', 'SALES_MANAGER');
    const body = await request.json().catch(() => null);
    const { managerId, day, field, value } = (body || {}) as Record<string, unknown>;

    if (typeof managerId !== 'string' || !isValidDay(day)) {
      return NextResponse.json({ message: 'Некорректный менеджер или дата' }, { status: 400 });
    }
    if (typeof field !== 'string' || !FUNNEL_INPUT_FIELDS.includes(field as FunnelInputField)) {
      return NextResponse.json({ message: 'Это поле нельзя изменить' }, { status: 400 });
    }
    const isUsd = field === 'adBudget';
    const isNumber = typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_VALUE;
    const validValue = isNumber && (isUsd ? Math.round(value * 100) === value * 100 : Number.isInteger(value));
    if (value !== null && !validValue) {
      return NextResponse.json({ message: isUsd ? 'Введите сумму в долларах, до центов' : 'Введите целое число от 0' }, { status: 400 });
    }
    const isAdmin = user.role === 'ADMIN';
    if (!isAdmin && managerId !== user.id) {
      return NextResponse.json({ message: 'Можно заполнять только свою воронку' }, { status: 403 });
    }
    if (!isAdmin && ADMIN_ONLY_FIELDS.includes(field as FunnelInputField)) {
      return NextResponse.json({ message: 'Заявки и рекламный бюджет заполняет руководитель' }, { status: 403 });
    }

    let columns: Record<string, number | null> = { [FIELD_TO_COLUMN[field as FunnelInputField]]: value as number | null };
    if (isUsd) {
      if (value === null) {
        columns = { ad_budget: null, ad_budget_usd: null, usd_rate: null };
      } else {
        const rate = await fetchUsdRate(day);
        if (!rate) {
          return NextResponse.json({ message: 'Не удалось получить курс доллара Нацбанка, попробуйте позже' }, { status: 502 });
        }
        columns = { ad_budget: Math.round((value as number) * rate), ad_budget_usd: value as number, usd_rate: rate };
      }
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('sales_funnel_days')
      .upsert(
        { manager_id: managerId, day, ...columns, updated_by: user.id },
        { onConflict: 'manager_id,day' },
      );
    if (error) throw error;
    return NextResponse.json({
      ok: true,
      ...(isUsd ? { adBudget: columns.ad_budget, adBudgetUsd: columns.ad_budget_usd, usdRate: columns.usd_rate } : {}),
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Не удалось сохранить' }, { status: 500 });
  }
}
