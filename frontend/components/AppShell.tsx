'use client';

import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background-light shadow-[inset_1px_0_0_0_rgb(0_0_0/0.04)]">
        {children}
      </main>
    </div>
  );
}
