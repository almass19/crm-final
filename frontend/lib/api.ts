const API_URL = '/api';

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Не авторизован');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Ошибка ${res.status}`);
  }

  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, fullName: string) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
    }),

  me: () => request('/auth/me'),

  getUsers: (role?: string) =>
    request(`/users${role ? `?role=${role}` : ''}`),

  updateUserRole: (userId: string, role: string) =>
    request(`/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  getClients: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/clients${query}`);
  },

  getClient: (id: string) => request(`/clients/${id}`),

  createClient: (data: Record<string, unknown>) =>
    request('/clients', { method: 'POST', body: JSON.stringify(data) }),

  updateClient: (id: string, data: Record<string, unknown>) =>
    request(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  archiveClient: (id: string) =>
    request(`/clients/${id}/archive`, { method: 'PATCH' }),

  assignClient: (id: string, data: { specialistId?: string; designerId?: string }) =>
    request(`/clients/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  acknowledgeClient: (id: string) =>
    request(`/clients/${id}/acknowledge`, { method: 'POST' }),

  getComments: (clientId: string) =>
    request(`/clients/${clientId}/comments`),

  addComment: (clientId: string, content: string) =>
    request(`/clients/${clientId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  // Dashboard
  getMyDashboard: (year: number, month: number) =>
    request(`/dashboard/my?year=${year}&month=${month}`),

  getAnalytics: (year: number, month: number) =>
    request(`/dashboard/analytics?year=${year}&month=${month}`),

  getUserDashboard: (userId: string, year: number, month: number) =>
    request(`/dashboard/user/${userId}?year=${year}&month=${month}`),

  // Employees (for admin dashboard)
  getEmployees: () => request('/users/employees'),

  // Tasks
  getClientTasks: (clientId: string) =>
    request(`/clients/${clientId}/tasks`),

  getMyTasks: () => request('/tasks/my'),

  getAllTasks: () => request('/tasks/all'),

  createTask: (data: Record<string, unknown>) =>
    request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTask: (taskId: string, data: Record<string, unknown>) =>
    request(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteTask: (taskId: string) =>
    request(`/tasks/${taskId}`, { method: 'DELETE' }),

  // Payments
  getClientPayments: (clientId: string) =>
    request(`/clients/${clientId}/payments`),

  createPayment: (clientId: string, data: { amount: number; month: string; isRenewal: boolean }) =>
    request(`/clients/${clientId}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Creatives
  getClientCreatives: (clientId: string) =>
    request(`/clients/${clientId}/creatives`),

  createCreative: (clientId: string, data: { count: number; month: string }) =>
    request(`/clients/${clientId}/creatives`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Renewals
  getRenewals: (month: string) =>
    request(`/renewals?month=${month}`),
};
