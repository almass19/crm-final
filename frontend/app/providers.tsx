'use client';

import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/Toast';
import { PrivacyProvider } from '@/lib/privacy';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PrivacyProvider>
        <ToastProvider>{children}</ToastProvider>
      </PrivacyProvider>
    </AuthProvider>
  );
}
