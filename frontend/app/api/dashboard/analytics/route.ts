import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    await requireRoles('ADMIN');
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
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    const [
      allClientsRes,
      newClientsRes,
      paymentsRes,
      tasksRes,
      creativesRes,
      profilesRes,
    ] = await Promise.all([
      // All non-archived clients (for total + status breakdown)
      supabase
        .from('clients')
        .select('id, status')
        .eq('archived', false),
      // Clients created this month
      supabase
        .from('clients')
        .select('id, created_by_id')
        .eq('archived', false)
        .gte('created_at', startDate)
        .lte('created_at', endDate),
      // Payments this month
      supabase
        .from('payments')
        .select('id, amount, manager_id')
        .eq('month', monthStr),
      // Tasks created this month
      supabase
        .from('tasks')
        .select('id, status')
        .gte('created_at', startDate)
        .lte('created_at', endDate),
      // Creatives this month
      supabase
        .from('creatives')
        .select('id, designer_id, count')
        .eq('month', monthStr),
      // Profiles for name mapping
      supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['SALES_MANAGER', 'SPECIALIST', 'DESIGNER', 'LEAD_DESIGNER']),
    ]);

    const allClients = allClientsRes.data || [];
    const newClients = newClientsRes.data || [];
    const payments = paymentsRes.data || [];
    const tasks = tasksRes.data || [];
    const creatives = creativesRes.data || [];
    const profiles = profilesRes.data || [];

    const profileMap = new Map(profiles.map(p => [p.id, p.full_name]));

    // Metric cards
    const totalClients = allClients.length;
    const newClientsThisMonth = newClients.length;
    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const completedTasks = tasks.filter(t => t.status === 'DONE').length;

    // Clients by status
    const statusCounts: Record<string, number> = {};
    for (const c of allClients) {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    }
    const clientsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));

    // New clients by manager (this month)
    const managerCounts: Record<string, number> = {};
    for (const c of newClients) {
      managerCounts[c.created_by_id] = (managerCounts[c.created_by_id] || 0) + 1;
    }
    const clientsByManager = Object.entries(managerCounts).map(([id, count]) => ({
      name: profileMap.get(id) || 'Неизвестный',
      count,
    }));

    // Revenue by manager
    const revByManager: Record<string, number> = {};
    for (const p of payments) {
      revByManager[p.manager_id] = (revByManager[p.manager_id] || 0) + (p.amount || 0);
    }
    const revenueByManager = Object.entries(revByManager).map(([id, amount]) => ({
      name: profileMap.get(id) || 'Неизвестный',
      amount,
    }));

    // Tasks by status
    const taskStatusCounts: Record<string, number> = {};
    for (const t of tasks) {
      taskStatusCounts[t.status] = (taskStatusCounts[t.status] || 0) + 1;
    }
    const tasksByStatus = Object.entries(taskStatusCounts).map(([status, count]) => ({
      status,
      count,
    }));

    // Creatives by designer
    const designerCounts: Record<string, number> = {};
    for (const cr of creatives) {
      designerCounts[cr.designer_id] = (designerCounts[cr.designer_id] || 0) + (cr.count || 0);
    }
    const creativesByDesigner = Object.entries(designerCounts).map(([id, count]) => ({
      name: profileMap.get(id) || 'Неизвестный',
      count,
    }));

    return NextResponse.json({
      totalClients,
      newClientsThisMonth,
      totalRevenue,
      completedTasks,
      clientsByStatus,
      clientsByManager,
      revenueByManager,
      tasksByStatus,
      creativesByDesigner,
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
