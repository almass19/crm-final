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

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
    const lastDay = new Date(year, month, 0).toISOString().slice(0, 10);

    const [
      profilesRes,
      soldClientsRes,
      paymentsRes,
      assignedTargetRes,
      activeTargetRes,
      targetTasksRes,
      creativesRes,
      assignedDesignerRes,
      designerTasksRes,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['SALES_MANAGER', 'TARGETOLOGIST', 'DESIGNER', 'LEAD_DESIGNER']),

      // Clients sold this month (for sales managers)
      supabase
        .from('clients')
        .select('id, sold_by_id, payment_amount')
        .eq('archived', false)
        .gte('purchase_date', `${monthStr}-01`)
        .lte('purchase_date', lastDay),

      // Payments this month (for sales managers)
      supabase
        .from('payments')
        .select('id, amount, manager_id, is_renewal')
        .eq('month', monthStr),

      // Clients assigned to targetologists this month
      supabase
        .from('clients')
        .select('id, assigned_to_id')
        .eq('archived', false)
        .eq('assignment_seen', true)
        .gte('assigned_at', startDate)
        .lte('assigned_at', endDate),

      // Active clients per targetologist (not archived, not done)
      supabase
        .from('clients')
        .select('id, assigned_to_id')
        .eq('archived', false)
        .not('assigned_to_id', 'is', null)
        .neq('status', 'DONE'),

      // Tasks assigned to targetologists, created this month
      supabase
        .from('tasks')
        .select('id, assignee_id, status')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('assignee_id', 'is', null),

      // Creatives this month (for designers)
      supabase
        .from('creatives')
        .select('id, designer_id, count')
        .eq('month', monthStr),

      // Clients assigned to designers this month
      supabase
        .from('clients')
        .select('id, designer_id')
        .eq('archived', false)
        .eq('designer_assignment_seen', true)
        .gte('designer_assigned_at', startDate)
        .lte('designer_assigned_at', endDate),

      // Tasks assigned to designers, created this month — reuse tasks query but filter by role later
      supabase
        .from('tasks')
        .select('id, assignee_id, status')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('assignee_id', 'is', null),
    ]);

    const profiles = profilesRes.data || [];
    const soldClients = soldClientsRes.data || [];
    const payments = paymentsRes.data || [];
    const assignedTarget = assignedTargetRes.data || [];
    const activeTarget = activeTargetRes.data || [];
    const targetTasks = targetTasksRes.data || [];
    const creatives = creativesRes.data || [];
    const assignedDesigner = assignedDesignerRes.data || [];
    const designerTasks = designerTasksRes.data || [];

    const salesManagers = profiles.filter(p => p.role === 'SALES_MANAGER');
    const targetologists = profiles.filter(p => p.role === 'TARGETOLOGIST');
    const designers = profiles.filter(p => p.role === 'DESIGNER' || p.role === 'LEAD_DESIGNER');

    // --- Sales Managers ---
    const salesManagerStats = salesManagers.map(p => {
      const mySold = soldClients.filter(c => c.sold_by_id === p.id);
      const myPayments = payments.filter(pay => pay.manager_id === p.id);
      const myRenewals = myPayments.filter(pay => pay.is_renewal);

      return {
        id: p.id,
        name: p.full_name,
        newClients: mySold.length,
        newClientsRevenue: mySold.reduce((s, c) => s + (Number(c.payment_amount) || 0), 0),
        paymentsCount: myPayments.length,
        paymentsRevenue: myPayments.reduce((s, pay) => s + (pay.amount || 0), 0),
        renewalsCount: myRenewals.length,
        renewalsRevenue: myRenewals.reduce((s, pay) => s + (pay.amount || 0), 0),
      };
    });

    // --- Targetologists ---
    const targetologistStats = targetologists.map(p => {
      const myAssigned = assignedTarget.filter(c => c.assigned_to_id === p.id);
      const myActive = activeTarget.filter(c => c.assigned_to_id === p.id);
      const myTasks = targetTasks.filter(t => t.assignee_id === p.id);
      const myDone = myTasks.filter(t => t.status === 'DONE');

      return {
        id: p.id,
        name: p.full_name,
        assignedThisMonth: myAssigned.length,
        activeClients: myActive.length,
        tasksCompleted: myDone.length,
        tasksTotal: myTasks.length,
      };
    });

    // --- Designers ---
    const designerStats = designers.map(p => {
      const myCreatives = creatives.filter(c => c.designer_id === p.id);
      const myAssigned = assignedDesigner.filter(c => c.designer_id === p.id);
      const myTasks = designerTasks.filter(t => t.assignee_id === p.id);
      const myDone = myTasks.filter(t => t.status === 'DONE');

      return {
        id: p.id,
        name: p.full_name,
        creativesCount: myCreatives.reduce((s, c) => s + (c.count || 0), 0),
        assignedThisMonth: myAssigned.length,
        tasksCompleted: myDone.length,
        tasksTotal: myTasks.length,
      };
    });

    return NextResponse.json({ salesManagers: salesManagerStats, targetologists: targetologistStats, designers: designerStats });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
