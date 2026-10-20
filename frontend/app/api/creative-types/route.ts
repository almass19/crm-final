import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

const CREATIVE_TYPES = ['STATIC_TEMPLATE', 'STATIC_CUSTOM', 'VIDEO'];

export async function GET() {
  try {
    await requireRoles('ADMIN', 'LEAD_DESIGNER', 'DESIGNER', 'TARGETOLOGIST');
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('creative_type_assignments')
      .select(`
        type,
        designer_id,
        designer:profiles!creative_type_assignments_designer_id_fkey(id, full_name)
      `);

    if (error) throw error;

    return NextResponse.json(snakeToCamel(data || []));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRoles('ADMIN', 'LEAD_DESIGNER');
    const supabase = await createClient();
    const body = await request.json();

    if (!CREATIVE_TYPES.includes(body.type)) {
      return NextResponse.json({ message: 'Некорректный тип креатива' }, { status: 400 });
    }
    if (!body.designerId) {
      return NextResponse.json({ message: 'Выберите дизайнера' }, { status: 400 });
    }

    const { data: designer } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', body.designerId)
      .single();

    if (!designer || !['DESIGNER', 'LEAD_DESIGNER'].includes(designer.role)) {
      return NextResponse.json({ message: 'Назначить можно только дизайнера' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('creative_type_assignments')
      .upsert({ type: body.type, designer_id: body.designerId, updated_at: new Date().toISOString() })
      .select(`
        type,
        designer_id,
        designer:profiles!creative_type_assignments_designer_id_fkey(id, full_name)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
