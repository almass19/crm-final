import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRoles('ADMIN');
    const { id } = await params;
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('publications')
      .select('id, author_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ message: 'Публикация не найдена' }, { status: 404 });
    }

    if (existing.author_id !== user.id) {
      return NextResponse.json({ message: 'Можно удалять только свои публикации' }, { status: 403 });
    }

    const { error } = await supabase.from('publications').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
