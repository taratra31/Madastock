import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface StoreSummary {
  id: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
  country: string;
  currency: string;
  active: boolean;
  createdAt: string;
  subscription: { status: string; plan: { name: string } } | null;
}

export interface Membership {
  id: string;
  role: string;
  isOwner: boolean;
  canManageAll: boolean;
  store: StoreSummary;
}

interface StoreContextValue {
  memberships: Membership[];
  currentStore: StoreSummary | null;
  setCurrentStore: (storeId: string) => void;
  selectFirstStore: (memberships: Membership[]) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const STORE_KEY = 'madastock_store_id';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentStore, setCurrentStoreState] = useState<StoreSummary | null>(() => {
    const id = localStorage.getItem(STORE_KEY);
    return id ? ({ id } as StoreSummary) : null;
  });

  const setCurrentStore = (storeId: string) => {
    localStorage.setItem(STORE_KEY, storeId);
    const found = memberships.find((m) => m.store.id === storeId);
    if (found) {
      setCurrentStoreState(found.store);
    }
  };

  const selectFirstStore = (list: Membership[]) => {
    setMemberships(list);
    const storedId = localStorage.getItem(STORE_KEY);
    const found = list.find((m) => m.store.id === storedId) ?? list[0];
    if (found) {
      localStorage.setItem(STORE_KEY, found.store.id);
      setCurrentStoreState(found.store);
    }
  };

  useEffect(() => {
    const host = localStorage.getItem(STORE_KEY);
    const found = memberships.find((m) => m.store.id === host);
    if (host && found) {
      setCurrentStoreState(found.store);
    }
  }, [memberships]);

  return (
    <StoreContext.Provider value={{ memberships, currentStore, setCurrentStore, selectFirstStore }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStores(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStores must be used within StoreProvider');
  return ctx;
}