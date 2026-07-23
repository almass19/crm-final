import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // matches the bucket's file_size_limit
const PDF_MAGIC_BYTES = '%PDF-';
const BUCKET = 'client-attachments';

async function getAccessibleClient(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('clients')
    .select('id, full_name, company_name')
    .eq('id', clientId)
    .single();
  return data;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-150);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id: clientId } = await params;

    const client = await getAccessibleClient(clientId);
    if (!client) {
      return NextResponse.json({ message: 'Клиент не найден' }, { status: 404 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('client_attachments')
      .select(`
        id, file_name, mime_type, size_bytes, created_at,
        uploaded_by:profiles!client_attachments_uploaded_by_id_fkey(id, full_name)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error('GET /api/clients/[id]/attachments error:', e);
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

    const client = await getAccessibleClient(clientId);
    if (!client) {
      return NextResponse.json({ message: 'Клиент не найден' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Файл не найден' }, { status: 400 });
    }

    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { message: 'Разрешены только PDF-файлы' },
        { status: 400 },
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { message: `Размер файла должен быть от 1 байта до ${MAX_FILE_SIZE_BYTES / 1024 / 1024} МБ` },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.subarray(0, 5).toString('latin1') !== PDF_MAGIC_BYTES) {
      return NextResponse.json(
        { message: 'Файл не является корректным PDF' },
        { status: 400 },
      );
    }

    const storagePath = `${clientId}/${randomUUID()}-${sanitizeFileName(file.name)}`;
    const admin = createAdminClient();

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: 'application/pdf' });

    if (uploadError) {
      console.error('Attachment upload error:', uploadError);
      return NextResponse.json({ message: 'Ошибка загрузки файла' }, { status: 500 });
    }

    const { data, error } = await admin
      .from('client_attachments')
      .insert({
        client_id: clientId,
        uploaded_by_id: user.id,
        file_name: file.name.slice(0, 255),
        storage_path: storagePath,
        mime_type: 'application/pdf',
        size_bytes: file.size,
      })
      .select(`
        id, file_name, mime_type, size_bytes, created_at,
        uploaded_by:profiles!client_attachments_uploaded_by_id_fkey(id, full_name)
      `)
      .single();

    if (error) {
      // Roll back the uploaded object if the metadata row couldn't be created.
      await admin.storage.from(BUCKET).remove([storagePath]);
      throw error;
    }

    await admin.from('audit_logs').insert({
      action: 'ATTACHMENT_UPLOADED',
      user_id: user.id,
      client_id: clientId,
      details: `Загружен файл: ${file.name}`,
    });

    return NextResponse.json(snakeToCamel(data));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error('POST /api/clients/[id]/attachments error:', e);
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
