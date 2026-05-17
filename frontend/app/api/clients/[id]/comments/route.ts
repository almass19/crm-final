import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, requireRoles } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';
import { createCommentNotification } from '@/lib/notifications';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id: clientId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('comments')
      .select(`
        id, content, created_at,
        author:profiles!comments_author_id_fkey(full_name, role)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(snakeToCamel(data));
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
    const user = await requireAuth();
    const { id: clientId } = await params;
    const { content } = await request.json();
    const supabase = await createClient();

    if (!content || !content.trim()) {
      return NextResponse.json(
        { message: 'Комментарий не может быть пустым' },
        { status: 400 },
      );
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id, full_name, company_name, assigned_to_id')
      .eq('id', clientId)
      .single();

    if (!client) {
      return NextResponse.json({ message: 'Клиент не найден' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        content,
        client_id: clientId,
        author_id: user.id,
      })
      .select(`
        id, content, created_at,
        author:profiles!comments_author_id_fkey(full_name, role)
      `)
      .single();

    if (error) throw error;

    if (client.assigned_to_id && client.assigned_to_id !== user.id) {
      const clientName = client.company_name || client.full_name || 'Клиент';
      await createCommentNotification(supabase, {
        specialistId: client.assigned_to_id,
        clientId,
        clientName,
        commentText: content,
        authorName: user.fullName,
      });
    }

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  _context: { params: Promise<{ id: string }> },
) {
  try {
    await requireRoles('ADMIN');
    const { commentId } = await request.json();
    const supabase = await createClient();

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
