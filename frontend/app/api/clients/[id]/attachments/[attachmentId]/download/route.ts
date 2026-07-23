import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-helpers';

const BUCKET = 'client-attachments';
const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    await requireAuth();
    const { id: clientId, attachmentId } = await params;

    const supabase = await createClient();

    // Scoped by RLS: returns null if the caller has no access to this client.
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
      .select('id, storage_path, file_name, client_id')
      .eq('id', attachmentId)
      .single();

    if (!attachment || attachment.client_id !== clientId) {
      return NextResponse.json({ message: 'Файл не найден' }, { status: 404 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(attachment.storage_path, SIGNED_URL_TTL_SECONDS, {
        download: attachment.file_name,
      });

    if (error || !data) throw error || new Error('Failed to create signed URL');

    return NextResponse.json({ url: data.signedUrl });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error('GET /api/clients/[id]/attachments/[attachmentId]/download error:', e);
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
