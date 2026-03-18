import { useCompany } from '@/contexts/CompanyContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, FileText } from 'lucide-react';
import { D4SignConfigForm } from '@/components/admin/D4SignConfigForm';
import { D4SignTemplateManager } from '@/components/admin/D4SignTemplateManager';

export default function AdminD4Sign() {
  const { selectedCompanyId } = useCompany();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integração D4Sign</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure credenciais globais e templates para assinatura digital de verbas indenizatórias
        </p>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Credenciais
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-4">
          <D4SignConfigForm />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <D4SignTemplateManager companyId={selectedCompanyId ?? ''} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
