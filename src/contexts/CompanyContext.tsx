import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Company {
  id: string;
  name: string;
  cnpj?: string;
  is_active: boolean;
  logo_url?: string;
  color?: string;
  external_id?: string; // código DAB (ex: '2', '3') — usado pelos hooks do Cockpit
}

interface CompanyContextType {
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  companies: Company[];
  setCompanies: (companies: Company[]) => void;
  selectedCompany: Company | null;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(() => {
    return localStorage.getItem('selectedCompanyId');
  });
  const [companies, setCompanies] = useState<Company[]>([]);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId) || null;

  const setSelectedCompanyId = (id: string | null) => {
    setSelectedCompanyIdState(id);
    if (id) {
      localStorage.setItem('selectedCompanyId', id);
    } else {
      localStorage.removeItem('selectedCompanyId');
    }
  };

  return (
    <CompanyContext.Provider
      value={{
        selectedCompanyId,
        setSelectedCompanyId,
        companies,
        setCompanies,
        selectedCompany,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
