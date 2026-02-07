const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function request(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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
};
