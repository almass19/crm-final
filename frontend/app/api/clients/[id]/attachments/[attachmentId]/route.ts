import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-helpers';

const BUCKET = 'client-attachments';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const user = await requireAuth();
    const { id: clientId, attachmentId } = await params;

    const supabase = await createClient();

    // Scoped by RLS: returns null if the caller has no access to this client,
    // which doubles as the access check.
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (!client) {
      return NextResponse.json({ message: 'Клиент не найден' }, { status: 404 });
    }

    const { data: attachment } = await supabase
      .from('client_attachments')
      .select('id, storage_path, uploaded_by_id, client_id')
      .eq('id', attachmentId)
      .single();

    if (!attachment || attachment.client_id !== clientId) {
      return NextResponse.json({ message: 'Файл не найден' }, { status: 404 });
    }

    if (user.role !== 'ADMIN' && attachment.uploaded_by_id !== user.id) {
      return NextResponse.json({ message: 'Недостаточно прав' }, { status: 403 });
    }

    const admin = createAdminClient();

    const { error: storageError } = await admin.storage
      .from(BUCKET)
      .remove([attachment.storage_path]);
    if (storageError) {
      console.error('Attachment storage delete error:', storageError);
    }

    const { error } = await admin
      .from('client_attachments')
      .delete()
      .eq('id', attachmentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error('DELETE /api/clients/[id]/attachments/[attachmentId] error:', e);
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
