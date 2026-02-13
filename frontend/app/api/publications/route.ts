import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, requireRoles } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

export async function GET() {
  try {
    await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('publications')
      .select('*, author:profiles!publications_author_id_fkey(full_name, role)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRoles('ADMIN');
    const body = await request.json();
    const supabase = await createClient();

    if (!body.title?.trim() || !body.content?.trim()) {
      return NextResponse.json(
        { message: 'Заголовок и содержание обязательны' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('publications')
      .insert({
        title: body.title,
        content: body.content,
        author_id: user.id,
      })
      .select('*, author:profiles!publications_author_id_fkey(full_name, role)')
      .single();

    if (error) throw error;

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
