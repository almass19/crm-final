import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { DailyCheckRow, almatyToday, fromRow, isValidDay } from '@/lib/daily-checks';

/** GET /api/daily-checks?day=YYYY-MM-DD → every client's check for that day (for the clients list). */
export async function GET(request: NextRequest) {
  try {
    await requireRoles('ADMIN');
    const day = request.nextUrl.searchParams.get('day') || almatyToday();
    if (!isValidDay(day)) return NextResponse.json({ message: 'Некорректная дата' }, { status: 400 });

    const supabase = await createClient();
    const rows = await fetchAll<DailyCheckRow>((a, b) => supabase
      .from('client_daily_checks')
      .select('client_id, day, complaint, slow_reply, overdue, note, updated_at')
      .eq('day', day)
      .order('client_id')
      .range(a, b));

    return NextResponse.json({ day, checks: rows.map(fromRow) });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
