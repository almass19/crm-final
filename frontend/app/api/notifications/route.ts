import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('is_read', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
