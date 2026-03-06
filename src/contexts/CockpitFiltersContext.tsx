import React, { createContext, useContext, useState, useCallback } from 'react';
import type { CockpitFilters } from '@/lib/cockpit-types';

interface CockpitFiltersContextType {
  filters: CockpitFilters;
  updateFilters: (updates: Partial<CockpitFilters>) => void;
  resetFilters: () => void;
}

const defaultFilters: CockpitFilters = {
  period: 'month',
  channelCode: 'ALL',
  segmentType: 'bu',
};

const CockpitFiltersContext = createContext<CockpitFiltersContextType | undefined>(undefined);

export function CockpitFiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<CockpitFilters>(defaultFilters);

  const updateFilters = useCallback((updates: Partial<CockpitFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  return (
    <CockpitFiltersContext.Provider value={{ filters, updateFilters, resetFilters }}>
      {children}
    </CockpitFiltersContext.Provider>
  );
}

export function useCockpitFilters() {
  const context = useContext(CockpitFiltersContext);
  if (context === undefined) {
    throw new Error('useCockpitFilters must be used within a CockpitFiltersProvider');
  }
  return context;
}
