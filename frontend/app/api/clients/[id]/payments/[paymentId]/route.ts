import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    await requireRoles('ADMIN');
    const { paymentId } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
