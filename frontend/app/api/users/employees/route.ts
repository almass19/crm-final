import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

export async function GET() {
  try {
    await requireRoles('ADMIN');
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .in('role', ['TARGETOLOGIST', 'DESIGNER', 'SALES_MANAGER'])
      .order('full_name', { ascending: true });

    if (error) throw error;

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
