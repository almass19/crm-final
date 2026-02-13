import { NextResponse } from 'next/server';
import { createClient } from './server';

export type UserRole = 'ADMIN' | 'SPECIALIST' | 'SALES_MANAGER' | 'DESIGNER' | 'LEAD_DESIGNER';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole | null;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as UserRole | null,
  };
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw NextResponse.json({ message: 'Не авторизован' }, { status: 401 });
  }
  return user;
}

export async function requireRoles(...roles: UserRole[]): Promise<AuthUser> {
  const user = await requireAuth();
  if (!user.role || !roles.includes(user.role)) {
    throw NextResponse.json({ message: 'Недостаточно прав' }, { status: 403 });
  }
  return user;
}
