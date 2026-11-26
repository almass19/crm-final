import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { CHECK_FLAGS, DailyCheckRow, NOTE_MAX_LENGTH, almatyToday, fromRow, isValidDay } from '@/lib/daily-checks';
import { createDailyCheckNoteNotification } from '@/lib/notifications';

const COLUMNS = 'client_id, day, complaint, slow_reply, overdue, note, updated_at';
const RECENT_LIMIT = 10;

/** GET /api/clients/:id/daily-check?day=YYYY-MM-DD → that day's check and the latest ones. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRoles('ADMIN');
    const { id: clientId } = await params;
    const day = request.nextUrl.searchParams.get('day') || almatyToday();
    if (!isValidDay(day)) return NextResponse.json({ message: 'Некорректная дата' }, { status: 400 });

    const supabase = await createClient();
    const [dayRes, recentRes] = await Promise.all([
      supabase.from('client_daily_checks').select(COLUMNS).eq('client_id', clientId).eq('day', day).maybeSingle(),
      supabase.from('client_daily_checks').select(COLUMNS).eq('client_id', clientId).order('day', { ascending: false }).limit(RECENT_LIMIT),
    ]);
    if (dayRes.error) throw dayRes.error;
    if (recentRes.error) throw recentRes.error;

    return NextResponse.json({
      check: dayRes.data ? fromRow(dayRes.data as DailyCheckRow) : null,
      recent: (recentRes.data || []).map((r) => fromRow(r as DailyCheckRow)),
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}

/** PUT /api/clients/:id/daily-check — save (create or replace) the check for one day. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles('ADMIN');
    const { id: clientId } = await params;
    const body = await request.json().catch(() => null);
    const { day, complaint, slowReply, overdue, note } = (body || {}) as Record<string, unknown>;

    if (!isValidDay(day) || day > almatyToday()) {
      return NextResponse.json({ message: 'Некорректная дата' }, { status: 400 });
    }
    if (![complaint, slowReply, overdue].every((v) => typeof v === 'boolean')) {
      return NextResponse.json({ message: 'Отметьте да или нет по каждому пункту' }, { status: 400 });
    }
    if (note !== null && note !== undefined && typeof note !== 'string') {
      return NextResponse.json({ message: 'Некорректное примечание' }, { status: 400 });
    }
    const cleanNote = typeof note === 'string' ? note.trim().slice(0, NOTE_MAX_LENGTH) || null : null;

    const supabase = await createClient();
    const [clientRes, prevRes] = await Promise.all([
      supabase.from('clients').select('id, assigned_to_id, group_name, full_name').eq('id', clientId).maybeSingle(),
      supabase.from('client_daily_checks').select('note').eq('client_id', clientId).eq('day', day).maybeSingle(),
    ]);
    if (clientRes.error) throw clientRes.error;
    if (prevRes.error) throw prevRes.error;
    const client = clientRes.data;
    if (!client) return NextResponse.json({ message: 'Клиент не найден' }, { status: 404 });

    const { data, error } = await supabase
      .from('client_daily_checks')
      .upsert({
        client_id: clientId,
        day,
        targetologist_id: client.assigned_to_id,
        complaint,
        slow_reply: slowReply,
        overdue,
        note: cleanNote,
        created_by_id: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id,day' })
      .select(COLUMNS)
      .single();
    if (error) throw error;
    const check = fromRow(data as DailyCheckRow);

    // A new or changed note goes to the client's targetologist (bell + Telegram).
    if (cleanNote && cleanNote !== (prevRes.data?.note ?? null) && client.assigned_to_id && client.assigned_to_id !== user.id) {
      try {
        await createDailyCheckNoteNotification(supabase, {
          targetologistId: client.assigned_to_id,
          clientId,
          clientName: client.group_name || client.full_name || 'Клиент',
          day,
          issues: CHECK_FLAGS.filter((f) => check[f.key]).map((f) => f.label),
          note: cleanNote,
          authorName: user.fullName || 'Руководитель',
        });
      } catch (notifyErr) {
        // The check is saved; a failed notification must not undo it.
        console.error('daily check note notification failed', notifyErr);
      }
    }

    return NextResponse.json({ check });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
