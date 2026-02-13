export type UserRole = 'ADMIN' | 'SPECIALIST' | 'SALES_MANAGER' | 'DESIGNER' | 'LEAD_DESIGNER';
export type ClientStatus = 'NEW' | 'ASSIGNED' | 'IN_WORK' | 'DONE' | 'REJECTED';
export type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'DONE';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole | null;
  createdAt?: string;
}

export interface Client {
  id: string;
  fullName: string | null;
  companyName: string | null;
  phone: string;
  groupName: string | null;
  services: string[];
  notes: string | null;
  paymentAmount: number | null;
  status: ClientStatus;
  archived: boolean;
  createdById: string;
  createdBy?: { fullName: string };
  assignedToId: string | null;
  assignedTo?: { fullName: string } | null;
  assignedAt: string | null;
  assignmentSeen: boolean;
  designerId: string | null;
  designer?: { fullName: string } | null;
  designerAssignedAt: string | null;
  designerAssignmentSeen: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  status: TaskStatus;
  clientId: string;
  client?: { id: string; fullName: string | null; companyName: string | null };
  creatorId: string;
  creator?: { id: string; fullName: string; role: UserRole | null };
  assigneeId: string | null;
  assignee?: { id: string; fullName: string; role: UserRole | null } | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  month: string;
  isRenewal: boolean;
  clientId: string;
  managerId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  content: string;
  clientId: string;
  authorId: string;
  author?: { fullName: string; role: UserRole | null };
  createdAt: string;
}

export interface Creative {
  id: string;
  clientId: string;
  designerId: string;
  designer?: { fullName: string; role: UserRole | null };
  count: number;
  month: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface Publication {
  id: string;
  title: string;
  content: string;
  authorId: string;
  author?: { fullName: string; role: UserRole | null };
  createdAt: string;
}

export interface AssignmentHistory {
  id: string;
  clientId: string;
  type: string;
  specialistId: string | null;
  specialist?: { fullName: string } | null;
  designerId: string | null;
  designer?: { fullName: string } | null;
  assignedById: string;
  assignedBy?: { fullName: string };
  assignedAt: string;
}
