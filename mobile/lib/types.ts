export type UserRole =
  | 'ADMIN'
  | 'TARGETOLOGIST'
  | 'SALES_MANAGER'
  | 'DESIGNER'
  | 'LEAD_DESIGNER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole | null;
}
