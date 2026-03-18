import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AppleNav } from './AppleNav';
import { AdminSidebar } from './AdminSidebar';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/external-client';
import { Building2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function AdminLayout() {
  const { selectedCompanyId, setSelectedCompanyId, companies, setCompanies } = useCompany();
  const location = useLocation();

  useEffect(() => {
    const fetchCompanies = async () => {
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (data) setCompanies(data);
    };
    fetchCompanies();
  }, [setCompanies]);

  return (
    <div className="min-h-screen bg-background">
      <AppleNav />

      {/* Barra do Seletor de Empresas */}
      <div className="fixed top-14 left-0 right-0 z-40 glass border-b border-border/50">
        <div className="container-apple py-2">
          <Select
            value={selectedCompanyId || 'all'}
            onValueChange={(value) => setSelectedCompanyId(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-full max-w-xs bg-secondary/50 border-none">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Todas as Empresas" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Empresas</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Shell: sidebar + conteúdo */}
      <div className="flex pt-28 min-h-screen">
        <AdminSidebar />

        {/* Área de conteúdo com transição ao trocar de rota */}
        <main
          key={location.pathname}
          className="flex-1 overflow-auto px-6 py-6 animate-in fade-in slide-in-from-right-2 duration-150"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
