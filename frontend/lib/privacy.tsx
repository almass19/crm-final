'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/lib/auth';

// Admin-only "hide money" mode — for showing the CRM on a screen or call
// without exposing amounts. Purely presentational: the API still returns
// the numbers, they're just not rendered. Remembered per browser.
const STORAGE_KEY = 'crm.hideMoney';
const HIDDEN_AMOUNT = '•••••';

interface PrivacyContextType {
  canHideMoney: boolean;
  hideMoney: boolean;
  toggleHideMoney: () => void;
}

const PrivacyContext = createContext<PrivacyContextType>({
  canHideMoney: false,
  hideMoney: false,
  toggleHideMoney: () => {},
});

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [stored, setStored] = useState(false);

  useEffect(() => {
    try {
      setStored(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // storage blocked (private mode) — mode just won't be remembered
    }
  }, []);

  const toggleHideMoney = useCallback(() => {
    setStored((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // see above
      }
      return next;
    });
  }, []);

  const canHideMoney = user?.role === 'ADMIN';
  return (
    <PrivacyContext.Provider value={{ canHideMoney, hideMoney: canHideMoney && stored, toggleHideMoney }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextType {
  return useContext(PrivacyContext);
}

// Formats an amount as "1 234 567 ₸", or masks it while the mode is on.
export function useMoney(): (value: number | string | null | undefined) => string {
  const { hideMoney } = usePrivacy();
  return useCallback(
    (value) => `${hideMoney ? HIDDEN_AMOUNT : Number(value || 0).toLocaleString('ru-RU')} ₸`,
    [hideMoney],
  );
}
