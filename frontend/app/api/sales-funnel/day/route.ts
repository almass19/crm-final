import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import {
  ADMIN_ONLY_FIELDS, FIELD_TO_COLUMN, FUNNEL_INPUT_FIELDS, FunnelInputField, isValidDay,
} from '@/lib/sales-funnel';

const MAX_VALUE = 1_000_000_000;

/**
 * PUT /api/sales-funnel/day  { managerId, day, field, value }
 * Saves one cell. A sales manager writes only their own days and not the ad
 * budget; an admin writes anyone's cells. value null clears the cell.
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
    const isInt = typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_VALUE;
    if (value !== null && !isInt) {
      return NextResponse.json({ message: 'Введите целое число от 0' }, { status: 400 });
    }
    const isAdmin = user.role === 'ADMIN';
    if (!isAdmin && managerId !== user.id) {
      return NextResponse.json({ message: 'Можно заполнять только свою воронку' }, { status: 403 });
    }
    if (!isAdmin && ADMIN_ONLY_FIELDS.includes(field as FunnelInputField)) {
      return NextResponse.json({ message: 'Рекламный бюджет заполняет руководитель' }, { status: 403 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('sales_funnel_days')
      .upsert(
        { manager_id: managerId, day, [FIELD_TO_COLUMN[field as FunnelInputField]]: value, updated_by: user.id },
        { onConflict: 'manager_id,day' },
      );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Не удалось сохранить' }, { status: 500 });
  }
}
