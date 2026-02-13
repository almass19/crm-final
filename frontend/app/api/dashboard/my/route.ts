import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { snakeToCamel } from '@/lib/utils/case-transform';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRoles('SPECIALIST', 'DESIGNER', 'SALES_MANAGER', 'LEAD_DESIGNER');
    const supabase = await createClient();

    const sp = request.nextUrl.searchParams;
    const year = parseInt(sp.get('year') || '');
    const month = parseInt(sp.get('month') || '');

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { message: 'Некорректные параметры year/month' },
        { status: 400 },
      );
    }

    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    const clientSelect = 'id, full_name, company_name, phone, group_name, status, services, created_at, assigned_at, designer_assigned_at';

    let query;

    switch (user.role) {
      case 'SPECIALIST':
        query = supabase
          .from('clients')
          .select(clientSelect)
          .eq('assigned_to_id', user.id)
          .eq('assignment_seen', true)
          .gte('assigned_at', startDate)
          .lte('assigned_at', endDate)
          .order('assigned_at', { ascending: false });
        break;

      case 'DESIGNER':
        query = supabase
          .from('clients')
          .select(clientSelect)
          .eq('designer_id', user.id)
          .eq('designer_assignment_seen', true)
          .gte('designer_assigned_at', startDate)
          .lte('designer_assigned_at', endDate)
          .order('designer_assigned_at', { ascending: false });
        break;

      case 'SALES_MANAGER':
        query = supabase
          .from('clients')
          .select(clientSelect)
          .eq('created_by_id', user.id)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .order('created_at', { ascending: false });
        break;

      case 'LEAD_DESIGNER':
        query = supabase
          .from('clients')
          .select(clientSelect)
          .eq('designer_id', user.id)
          .eq('designer_assignment_seen', true)
          .gte('designer_assigned_at', startDate)
          .lte('designer_assigned_at', endDate)
          .order('designer_assigned_at', { ascending: false });
        break;

      default:
        return NextResponse.json({
          count: 0,
          clients: [],
          month,
          year,
          role: user.role,
        });
    }

    const { data: clients, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      count: (clients || []).length,
      clients: snakeToCamel(clients || []),
      month,
      year,
      role: user.role,
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
