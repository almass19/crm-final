import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

export async function GET(request: NextRequest) {
  try {
    await requireRoles('ADMIN', 'LEAD_DESIGNER');
    const supabase = await createClient();

    const role = request.nextUrl.searchParams.get('role');

    let query = supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .order('created_at', { ascending: false });

    if (role) {
      const upperRole = role.toUpperCase();
      if (['ADMIN', 'SPECIALIST', 'SALES_MANAGER', 'DESIGNER', 'LEAD_DESIGNER'].includes(upperRole)) {
        query = query.eq('role', upperRole);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
