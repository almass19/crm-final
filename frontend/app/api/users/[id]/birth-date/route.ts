import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRoles('ADMIN');
    const { id } = await params;
    const { birthDate } = await request.json();

    // null clears the date
    const isValid = birthDate === null
      || (typeof birthDate === 'string'
        && BIRTH_DATE_PATTERN.test(birthDate)
        && !Number.isNaN(Date.parse(birthDate))
        && birthDate <= new Date().toISOString().slice(0, 10));
    if (!isValid) {
      return NextResponse.json({ message: 'Некорректная дата рождения' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .update({ birth_date: birthDate })
      .eq('id', id)
      .select('id, email, full_name, role, created_at, birth_date')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ message: 'Пользователь не найден' }, { status: 404 });
    }

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
