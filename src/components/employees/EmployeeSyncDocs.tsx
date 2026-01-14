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

  const sqlViewExample = `-- View para sincronização de funcionários (Gestão de Ativos → GA360)
CREATE VIEW vw_sync_employees_ga360 AS
SELECT 
    CAST(f.id AS VARCHAR(36)) AS id,
    f.nome,
    f.cpf,
    f.email,
    f.cargo,
    f.departamento,
    f.unidade,
    f.status,
    f.is_condutor,
    f.cod_vendedor,
    CAST(f.lider_direto_id AS VARCHAR(36)) AS lider_direto_id
FROM funcionarios f;

-- Opcional: adicionar filtro de status se quiser sincronizar apenas ativos
-- WHERE f.status = 'Ativo';`;

  const powershellScript = `# sync-funcionarios-ga360.ps1
# Sincronização de Funcionários: Gestão de Ativos → GA360

# ============================================================
# CONFIGURAÇÃO
# ============================================================
$ApiUrl = "${apiEndpoint}"
$ApiKey = "SUA_SYNC_API_KEY_AQUI"
$CompanyExternalId = "${(selectedCompany as any)?.external_id || 'CODIGO_EMPRESA'}"
$SqlServer = "seu-servidor"
$Database = "gestao_ativos"

# ============================================================
# BUSCAR DADOS DO SQL SERVER
# ============================================================
$Query = @"
SELECT 
    CAST(f.id AS VARCHAR(36)) AS id,
    f.nome,
    f.cpf,
    f.email,
    f.cargo,
    f.departamento,
    f.unidade,
    f.status,
    CAST(f.is_condutor AS BIT) AS is_condutor,
    f.cod_vendedor,
    CAST(f.lider_direto_id AS VARCHAR(36)) AS lider_direto_id
FROM funcionarios f
"@

Write-Host "Buscando funcionários do banco de dados..." -ForegroundColor Cyan
$Employees = Invoke-Sqlcmd -Query $Query -ServerInstance $SqlServer -Database $Database

if ($Employees.Count -eq 0) {
    Write-Host "Nenhum funcionário encontrado." -ForegroundColor Yellow
    exit 0
}

Write-Host "Encontrados $($Employees.Count) funcionários." -ForegroundColor Green

# ============================================================
# MONTAR PAYLOAD JSON
# ============================================================
$EmployeesList = @()
foreach ($emp in $Employees) {
    $employee = @{
        id = $emp.id
        nome = $emp.nome
        cpf = $emp.cpf
        email = if ($emp.email) { $emp.email } else { $null }
        cargo = if ($emp.cargo) { $emp.cargo } else { $null }
        departamento = if ($emp.departamento) { $emp.departamento } else { $null }
        unidade = if ($emp.unidade) { $emp.unidade } else { $null }
        status = if ($emp.status) { $emp.status } else { "Ativo" }
        is_condutor = [bool]$emp.is_condutor
        cod_vendedor = if ($emp.cod_vendedor) { $emp.cod_vendedor } else { $null }
        lider_direto_id = if ($emp.lider_direto_id) { $emp.lider_direto_id } else { $null }
    }
    $EmployeesList += $employee
}

$Body = @{
    company_external_id = $CompanyExternalId
    source_system = "gestao_ativos"
    employees = $EmployeesList
} | ConvertTo-Json -Depth 10

# ============================================================
# ENVIAR DADOS PARA API
# ============================================================
$Headers = @{
    "Content-Type" = "application/json"
    "X-API-Key" = $ApiKey
}

Write-Host "Enviando dados para GA360..." -ForegroundColor Cyan

try {
    $Response = Invoke-RestMethod -Uri $ApiUrl -Method POST -Body $Body -Headers $Headers -ContentType "application/json; charset=utf-8"
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Total recebidos: $($Response.total_received)" -ForegroundColor White
    Write-Host "Criados:         $($Response.created)" -ForegroundColor Green
    Write-Host "Atualizados:     $($Response.updated)" -ForegroundColor Yellow
    Write-Host "Falhas:          $($Response.failed)" -ForegroundColor $(if ($Response.failed -gt 0) { "Red" } else { "White" })
    
    if ($Response.errors) {
        Write-Host ""
        Write-Host "Erros:" -ForegroundColor Red
        foreach ($err in $Response.errors) {
            Write-Host "  - [$($err.external_id)] $($err.error)" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "        ERRO NA SINCRONIZAÇÃO" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Detalhes: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host "Resposta: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    
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
              <h4 className="font-semibold mb-2">Payload JSON (Formato Gestão de Ativos)</h4>
              <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
{`{
  "company_external_id": "${(selectedCompany as any)?.external_id || 'CODIGO_EMPRESA'}",
  "source_system": "gestao_ativos",
  "employees": [
    {
      "id": "uuid-do-funcionario",
      "nome": "Nome Completo do Funcionário",
      "cpf": "12345678901",
      "email": "email@empresa.com",
      "cargo": "Analista",
      "departamento": "TI",
      "unidade": "Matriz",
      "status": "Ativo",
      "is_condutor": true,
      "cod_vendedor": "V001",
      "lider_direto_id": "uuid-do-lider"
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
                  <li><code>id</code>: UUID do funcionário no Gestão de Ativos</li>
                  <li><code>nome</code>: Nome completo do funcionário</li>
                </ul>
                <p className="mt-2 text-muted-foreground">Os demais campos são opcionais.</p>
              </AlertDescription>
            </Alert>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Mapeamento de Campos</AlertTitle>
              <AlertDescription>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div><code>id</code> → <code>external_id</code></div>
                  <div><code>nome</code> → <code>full_name</code></div>
                  <div><code>cpf</code> → <code>cpf</code></div>
                  <div><code>cargo</code> → <code>position</code></div>
                  <div><code>departamento</code> → <code>department</code></div>
                  <div><code>unidade</code> → <code>unidade</code></div>
                  <div><code>status</code> → <code>is_active</code></div>
                  <div><code>is_condutor</code> → <code>is_condutor</code></div>
                  <div><code>cod_vendedor</code> → <code>cod_vendedor</code></div>
                  <div><code>lider_direto_id</code> → <code>lider_direto_id</code></div>
                </div>
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
                Esta view espelha a estrutura da tabela <code>funcionarios</code> do Gestão de Ativos.
                O campo <code>id</code> (UUID) será usado como identificador único para cada funcionário.
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
                        <li>Command: <code>powershell.exe -File "C:\Scripts\sync-funcionarios-ga360.ps1"</code></li>
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
                    <li>Arguments: <code>-File "C:\Scripts\sync-funcionarios-ga360.ps1"</code></li>
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
