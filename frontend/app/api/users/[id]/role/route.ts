import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRoles('ADMIN');
    const { id } = await params;
    const { role } = await request.json();
    const supabase = await createClient();

    const validRoles = ['ADMIN', 'TARGETOLOGIST', 'SALES_MANAGER', 'DESIGNER'];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ message: 'Некорректная роль' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ message: 'Пользователь не найден' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', id)
      .select('id, email, full_name, role, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
