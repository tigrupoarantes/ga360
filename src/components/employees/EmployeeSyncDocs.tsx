import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCompany } from "@/contexts/CompanyContext";
import { Code, Copy, Terminal, AlertCircle, Database } from "lucide-react";
import { toast } from "sonner";

export function EmployeeSyncDocs() {
  const { selectedCompany } = useCompany();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };

  const apiEndpoint = `https://aqromdreppgztagafinr.supabase.co/functions/v1/sync-employees`;

  const sqlViewExample = `-- View para sincronização de funcionários
CREATE VIEW vw_sync_employees AS
SELECT 
    CAST(id AS VARCHAR(50)) AS external_id,
    matricula AS registration_number,
    nome_completo AS full_name,
    email,
    telefone AS phone,
    departamento AS department,
    cargo AS position,
    CONVERT(DATE, data_admissao) AS hire_date,
    CASE WHEN status = 'A' THEN 1 ELSE 0 END AS is_active
FROM funcionarios
WHERE status IN ('A', 'I'); -- Ativos e Inativos`;

  const powershellScript = `# sync-funcionarios.ps1
# Configuração
$ApiUrl = "${apiEndpoint}"
$ApiKey = "SUA_SYNC_API_KEY_AQUI"

# Buscar dados do SQL Server (Gestão de Ativos)
$Query = "SELECT * FROM vw_sync_employees"
$Employees = Invoke-Sqlcmd -Query $Query -ServerInstance "seu-servidor" -Database "gestao_ativos"

# Montar payload JSON
$Body = @{
    company_external_id = "${(selectedCompany as any)?.external_id || 'CODIGO_EMPRESA'}"
    source_system = "gestao_ativos"
    employees = $Employees | ForEach-Object {
        @{
            external_id = $_.external_id
            registration_number = $_.registration_number
            full_name = $_.full_name
            email = $_.email
            phone = $_.phone
            department = $_.department
            position = $_.position
            hire_date = if ($_.hire_date) { $_.hire_date.ToString("yyyy-MM-dd") } else { $null }
            is_active = [bool]$_.is_active
        }
    }
} | ConvertTo-Json -Depth 10

# Headers
$Headers = @{
    "Content-Type" = "application/json"
    "X-API-Key" = $ApiKey
}

# Enviar dados
try {
    $Response = Invoke-RestMethod -Uri $ApiUrl -Method POST -Body $Body -Headers $Headers
    Write-Host "Sincronização concluída com sucesso!"
    Write-Host "Criados: $($Response.created) | Atualizados: $($Response.updated) | Falhas: $($Response.failed)"
} catch {
    Write-Error "Erro na sincronização: $_"
    exit 1
}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          Configuração da Sincronização de Funcionários
        </CardTitle>
        <CardDescription>
          Instruções para configurar o envio automático de dados do sistema Gestão de Ativos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="endpoint" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="endpoint">Endpoint API</TabsTrigger>
            <TabsTrigger value="sql">SQL Server</TabsTrigger>
            <TabsTrigger value="script">PowerShell</TabsTrigger>
          </TabsList>

          <TabsContent value="endpoint" className="space-y-4 mt-4">
            <div>
              <h4 className="font-semibold mb-2">URL do Endpoint</h4>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-muted rounded-md text-sm font-mono break-all">
                  {apiEndpoint}
                </code>
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiEndpoint)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Método</h4>
              <Badge>POST</Badge>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Headers Obrigatórios</h4>
              <div className="bg-muted p-3 rounded-md font-mono text-sm space-y-1">
                <div><span className="text-primary">Content-Type:</span> application/json</div>
                <div><span className="text-primary">X-API-Key:</span> [sua SYNC_API_KEY]</div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Payload JSON</h4>
              <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
{`{
  "company_external_id": "${(selectedCompany as any)?.external_id || 'CODIGO_EMPRESA'}",
  "source_system": "gestao_ativos",
  "employees": [
    {
      "external_id": "unique_id",
      "registration_number": "12345",
      "full_name": "Nome do Funcionário",
      "email": "email@empresa.com",
      "phone": "(11) 99999-9999",
      "department": "TI",
      "position": "Analista",
      "hire_date": "2020-01-15",
      "is_active": true,
      "metadata": { "campo_extra": "valor" }
    }
  ]
}`}</pre>
            </div>

            {!(selectedCompany as any)?.external_id && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Configure um <strong>external_id</strong> para esta empresa nas configurações administrativas.
                  Este código será usado para identificar a empresa nas sincronizações.
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <Database className="h-4 w-4" />
              <AlertTitle>Campos Obrigatórios</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li><code>external_id</code>: Identificador único do funcionário no sistema de origem</li>
                  <li><code>full_name</code>: Nome completo do funcionário</li>
                </ul>
                Os demais campos são opcionais.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="sql" className="space-y-4 mt-4">
            <div>
              <h4 className="font-semibold mb-2">View de Exemplo para SQL Server</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Crie esta view no banco de dados do Gestão de Ativos para preparar os dados:
              </p>
              <div className="relative">
                <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto max-h-[400px]">
                  {sqlViewExample}
                </pre>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(sqlViewExample)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>
                Adapte a view para corresponder aos nomes das suas tabelas e colunas no banco Gestão de Ativos.
                O campo <code>external_id</code> deve ser único por funcionário.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="script" className="space-y-4 mt-4">
            <div>
              <h4 className="font-semibold mb-2">Script PowerShell para Sincronização</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Use este script para enviar dados do Gestão de Ativos para o GA360. 
                Configure-o no SQL Agent ou Task Scheduler para execução automática.
              </p>
              <div className="relative">
                <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto max-h-[500px]">
                  {powershellScript}
                </pre>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(powershellScript)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Terminal className="h-4 w-4 mr-2" />
                  Ver instruções de agendamento
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="bg-muted p-4 rounded-md space-y-3">
                  <h5 className="font-semibold">Configurar Job no SQL Agent:</h5>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Abra o SQL Server Management Studio</li>
                    <li>Expanda SQL Server Agent → Jobs</li>
                    <li>Clique com botão direito → New Job</li>
                    <li>Na aba "General", dê um nome como "Sync Funcionários GA360"</li>
                    <li>Na aba "Steps", clique em New e configure:
                      <ul className="list-disc list-inside ml-4 mt-1">
                        <li>Type: Operating system (CmdExec)</li>
                        <li>Command: <code>powershell.exe -File "C:\Scripts\sync-funcionarios.ps1"</code></li>
                      </ul>
                    </li>
                    <li>Na aba "Schedules", configure execução diária (ex: 6h)</li>
                    <li>Na aba "Notifications", configure email em caso de falha</li>
                    <li>Clique OK para salvar</li>
                  </ol>

                  <h5 className="font-semibold mt-4">Alternativa: Task Scheduler do Windows</h5>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Abra o Task Scheduler</li>
                    <li>Create Task → Dê um nome</li>
                    <li>Triggers → New → Diariamente às 6h</li>
                    <li>Actions → New → Start a program</li>
                    <li>Program: <code>powershell.exe</code></li>
                    <li>Arguments: <code>-File "C:\Scripts\sync-funcionarios.ps1"</code></li>
                  </ol>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
