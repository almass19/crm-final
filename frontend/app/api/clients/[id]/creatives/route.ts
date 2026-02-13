import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRoles('ADMIN', 'DESIGNER', 'LEAD_DESIGNER');
    const { id: clientId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('creatives')
      .select(`
        *,
        designer:profiles!creatives_designer_id_fkey(full_name, role)
      `)
      .eq('client_id', clientId)
      .order('month', { ascending: false });

    if (error) throw error;

    return NextResponse.json(snakeToCamel(data || []));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRoles('DESIGNER', 'LEAD_DESIGNER');
    const { id: clientId } = await params;
    const { count, month } = await request.json();
    const supabase = await createClient();

    if (!count || count <= 0) {
      return NextResponse.json(
        { message: 'Количество должно быть больше 0' },
        { status: 400 },
      );
    }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { message: 'Некорректный формат месяца (YYYY-MM)' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('creatives')
      .insert({
        client_id: clientId,
        designer_id: user.id,
        count,
        month,
      })
      .select(`
        *,
        designer:profiles!creatives_designer_id_fkey(full_name, role)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
