import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

function sanitizeClient(client: Record<string, unknown>, role: string | null) {
  if (role === 'SPECIALIST' || role === 'DESIGNER') {
    const { payment_amount, ...rest } = client;
    return rest;
  }
  return client;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const sp = request.nextUrl.searchParams;

    const search = sp.get('search');
    const status = sp.get('status');
    const unassigned = sp.get('unassigned') === 'true';
    const createdById = sp.get('createdById');
    const specialistId = sp.get('specialistId');
    const sortBy = sp.get('sortBy') || 'created_at';
    const sortOrder = sp.get('sortOrder') || 'desc';

    // Map frontend sort fields to DB columns
    const sortFieldMap: Record<string, string> = {
      createdAt: 'created_at',
      created_at: 'created_at',
      fullName: 'full_name',
      full_name: 'full_name',
      companyName: 'company_name',
      company_name: 'company_name',
      status: 'status',
      assignedAt: 'assigned_at',
      assigned_at: 'assigned_at',
    };
    const dbSortField = sortFieldMap[sortBy] || 'created_at';

    let query = supabase
      .from('clients')
      .select(`
        *,
        created_by:profiles!clients_created_by_id_fkey(full_name),
        sold_by:profiles!clients_sold_by_id_fkey(full_name),
        assigned_to:profiles!clients_assigned_to_id_fkey(full_name),
        designer:profiles!clients_designer_id_fkey(full_name)
      `)
      .eq('archived', false)
      .order(dbSortField, { ascending: sortOrder === 'asc' });

    // Role-based access restrictions
    if (user.role === 'SPECIALIST') {
      query = query.eq('assigned_to_id', user.id);
    } else if (user.role === 'DESIGNER') {
      query = query.eq('designer_id', user.id);
    }

    // Filters
    if (status) {
      query = query.eq('status', status);
    }

    if (unassigned) {
      query = query.is('assigned_to_id', null);
    }

    if (createdById && (user.role === 'ADMIN' || user.role === 'LEAD_DESIGNER')) {
      query = query.eq('created_by_id', createdById);
    }

    if (specialistId && (user.role === 'ADMIN' || user.role === 'LEAD_DESIGNER')) {
      query = query.eq('assigned_to_id', specialistId);
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,company_name.ilike.%${search}%,phone.ilike.%${search}%,group_name.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    const sanitized = (data || []).map((c) => sanitizeClient(c, user.role));
    return NextResponse.json(snakeToCamel(sanitized));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    if (user.role !== 'SALES_MANAGER' && user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Недостаточно прав' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = await createClient();

    if (!body.fullName && !body.companyName) {
      return NextResponse.json(
        { message: 'Необходимо указать ФИО или название компании' },
        { status: 400 },
      );
    }

    if (!body.phone) {
      return NextResponse.json(
        { message: 'Телефон обязателен' },
        { status: 400 },
      );
    }

    if (!body.services || !Array.isArray(body.services) || body.services.length === 0) {
      return NextResponse.json(
        { message: 'Выберите хотя бы одну услугу' },
        { status: 400 },
      );
    }

    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        full_name: body.fullName || null,
        company_name: body.companyName || null,
        phone: body.phone,
        group_name: body.groupName || null,
        services: body.services,
        notes: body.notes || null,
        payment_amount: body.paymentAmount ?? null,
        created_by_id: user.id,
        sold_by_id: body.soldById || (user.role === 'SALES_MANAGER' ? user.id : null),
      })
      .select(`
        *,
        created_by:profiles!clients_created_by_id_fkey(full_name),
        sold_by:profiles!clients_sold_by_id_fkey(full_name),
        assigned_to:profiles!clients_assigned_to_id_fkey(full_name),
        designer:profiles!clients_designer_id_fkey(full_name)
      `)
      .single();

    if (error) throw error;

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'CLIENT_CREATED',
      user_id: user.id,
      client_id: client.id,
      details: `Клиент создан: ${body.fullName || body.companyName}`,
    });

    return NextResponse.json(snakeToCamel(client));
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
