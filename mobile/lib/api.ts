import { supabase } from './supabase';

const CLIENT_SELECT = `
  id, full_name, company_name, phone, group_name, niche, services, notes,
  client_type, payment_amount, status, assignment_seen, designer_assignment_seen,
  purchase_date, launch_date, created_at, assigned_at, designer_assigned_at,
  sold_by_id, assigned_to_id, designer_id, created_by_id, is_archived,
  assigned_to:profiles!clients_assigned_to_id_fkey(id, full_name, role),
  designer:profiles!clients_designer_id_fkey(id, full_name, role),
  sold_by:profiles!clients_sold_by_id_fkey(id, full_name),
  created_by:profiles!clients_created_by_id_fkey(id, full_name, role)
`;

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  return { start, end };
}

export const mobileApi = {
  // ── CLIENTS ──────────────────────────────────────────────────────────────

  async getClients(userId: string, role: string, filters?: {
    status?: string;
    search?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }) {
    let query = supabase
      .from('clients')
      .select(CLIENT_SELECT)
      .eq('is_archived', false);

    if (role === 'TARGETOLOGIST') {
      query = query.eq('assigned_to_id', userId);
    } else if (role === 'DESIGNER') {
      query = query.eq('designer_id', userId);
    } else if (role === 'SALES_MANAGER') {
      const { start, end } = getMonthRange();
      query = query
        .eq('sold_by_id', userId)
        .gte('created_at', start)
        .lte('created_at', end);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const sortField = filters?.sortBy || 'created_at';
    const sortAsc = filters?.sortDir === 'asc';
    query = query.order(sortField, { ascending: sortAsc });

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let result = data || [];
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((c: { full_name?: string; company_name?: string; phone?: string }) =>
        (c.full_name || '').toLowerCase().includes(s) ||
        (c.company_name || '').toLowerCase().includes(s) ||
        (c.phone || '').includes(s)
      );
    }
    return result;
  },

  async getClient(id: string) {
    const { data, error } = await supabase
      .from('clients')
      .select(CLIENT_SELECT)
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async createClient(payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('clients')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateClient(id: string, payload: Record<string, unknown>) {
    const { error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async archiveClient(id: string) {
    const { error } = await supabase
      .from('clients')
      .update({ is_archived: true })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteClient(id: string) {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async acknowledgeClient(id: string, field: 'assignment_seen' | 'designer_assignment_seen') {
    const { error } = await supabase
      .from('clients')
      .update({ [field]: true })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async assignSpecialist(id: string, specialistId: string) {
    const { error } = await supabase
      .from('clients')
      .update({
        assigned_to_id: specialistId,
        assigned_at: new Date().toISOString(),
        assignment_seen: false,
        status: 'ASSIGNED',
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async assignDesigner(id: string, designerId: string) {
    const { error } = await supabase
      .from('clients')
      .update({
        designer_id: designerId,
        designer_assigned_at: new Date().toISOString(),
        designer_assignment_seen: false,
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ── COMMENTS ─────────────────────────────────────────────────────────────

  async getComments(clientId: string) {
    const { data, error } = await supabase
      .from('comments')
      .select('id, content, created_at, author_id, author:profiles!comments_author_id_fkey(id, full_name, role)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async addComment(clientId: string, content: string, authorId: string) {
    const { error } = await supabase
      .from('comments')
      .insert({ client_id: clientId, content, author_id: authorId });
    if (error) throw new Error(error.message);
  },

  async deleteComment(commentId: string) {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);
    if (error) throw new Error(error.message);
  },

  // ── TASKS ─────────────────────────────────────────────────────────────────

  async getMyTasks(userId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id, title, description, priority, status, due_date, created_at,
        client_id, creator_id, assignee_id,
        client:clients(id, full_name, company_name),
        creator:profiles!tasks_creator_id_fkey(id, full_name, role),
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, role)
      `)
      .or(`creator_id.eq.${userId},assignee_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getAllTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id, title, description, priority, status, due_date, created_at,
        client_id, creator_id, assignee_id,
        client:clients(id, full_name, company_name),
        creator:profiles!tasks_creator_id_fkey(id, full_name, role),
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, role)
      `)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getClientTasks(clientId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id, title, description, priority, status, due_date, created_at,
        client_id, creator_id, assignee_id,
        creator:profiles!tasks_creator_id_fkey(id, full_name, role),
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, role)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createTask(payload: {
    title: string;
    description?: string;
    priority: number;
    client_id: string;
    assignee_id?: string;
    due_date?: string;
    creator_id: string;
  }) {
    const { error } = await supabase
      .from('tasks')
      .insert({ ...payload, status: 'NEW' });
    if (error) throw new Error(error.message);
  },

  async updateTask(taskId: string, payload: Record<string, unknown>) {
    const { error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', taskId);
    if (error) throw new Error(error.message);
  },

  async deleteTask(taskId: string) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
    if (error) throw new Error(error.message);
  },

  // ── PAYMENTS ─────────────────────────────────────────────────────────────

  async getClientPayments(clientId: string) {
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount, month, payment_date, is_renewal, created_at, manager_id, manager:profiles!payments_manager_id_fkey(id, full_name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createPayment(clientId: string, payload: {
    amount: number;
    payment_date: string;
    is_renewal: boolean;
    manager_id: string;
  }) {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { error } = await supabase
      .from('payments')
      .insert({ ...payload, client_id: clientId, month });
    if (error) throw new Error(error.message);
  },

  async deletePayment(paymentId: string) {
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId);
    if (error) throw new Error(error.message);
  },

  // ── CREATIVES ─────────────────────────────────────────────────────────────

  async getClientCreatives(clientId: string) {
    const { data, error } = await supabase
      .from('creatives')
      .select('id, client_id, designer_id, count, month, created_at, designer:profiles!creatives_designer_id_fkey(id, full_name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createCreative(clientId: string, designerId: string, payload: { count: number; month: string }) {
    const { error } = await supabase
      .from('creatives')
      .insert({ ...payload, client_id: clientId, designer_id: designerId });
    if (error) throw new Error(error.message);
  },

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────

  async getNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, data, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async markNotificationRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    if (error) throw new Error(error.message);
  },

  async markAllNotificationsRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw new Error(error.message);
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) return 0;
    return count || 0;
  },

  // ── USERS ─────────────────────────────────────────────────────────────────

  async getUsers(role?: string) {
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .order('full_name');
    if (role) {
      query = query.eq('role', role.toUpperCase());
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async updateUserRole(userId: string, role: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);
    if (error) throw new Error(error.message);
  },

  async changePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },

  // ── DASHBOARD ─────────────────────────────────────────────────────────────

  async getDashboard(userId: string, role: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1).toISOString();
    const end = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    const MINI = 'id, full_name, company_name, phone, status, services, purchase_date, created_at, assigned_at, designer_assigned_at';

    if (role === 'TARGETOLOGIST') {
      const { data, count, error } = await supabase
        .from('clients')
        .select(MINI, { count: 'exact' })
        .eq('assigned_to_id', userId)
        .eq('is_archived', false)
        .gte('assigned_at', start)
        .lte('assigned_at', end);
      if (error) throw new Error(error.message);
      return { count: count ?? 0, clients: data ?? [] };
    }

    if (role === 'DESIGNER' || role === 'LEAD_DESIGNER') {
      const { data, count, error } = await supabase
        .from('clients')
        .select(MINI, { count: 'exact' })
        .eq('designer_id', userId)
        .eq('is_archived', false)
        .gte('designer_assigned_at', start)
        .lte('designer_assigned_at', end);
      if (error) throw new Error(error.message);
      return { count: count ?? 0, clients: data ?? [] };
    }

    if (role === 'SALES_MANAGER') {
      const { data, count, error } = await supabase
        .from('clients')
        .select(MINI, { count: 'exact' })
        .eq('sold_by_id', userId)
        .eq('is_archived', false)
        .gte('created_at', start)
        .lte('created_at', end);
      if (error) throw new Error(error.message);
      return { count: count ?? 0, clients: data ?? [] };
    }

    if (role === 'ADMIN') {
      const [created, asSpec] = await Promise.all([
        supabase
          .from('clients')
          .select(MINI, { count: 'exact' })
          .eq('created_by_id', userId)
          .eq('is_archived', false)
          .gte('created_at', start)
          .lte('created_at', end),
        supabase
          .from('clients')
          .select(MINI, { count: 'exact' })
          .eq('assigned_to_id', userId)
          .eq('is_archived', false)
          .gte('assigned_at', start)
          .lte('assigned_at', end),
      ]);
      const allClients = [...(created.data ?? []), ...(asSpec.data ?? [])];
      const seen = new Set<string>();
      const unique = allClients.filter((c: { id: string }) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      return {
        createdCount: created.count ?? 0,
        specialistCount: asSpec.count ?? 0,
        clients: unique,
      };
    }

    return { count: 0, clients: [] };
  },

  async deleteUser(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (error) throw new Error(error.message);
  },
};
