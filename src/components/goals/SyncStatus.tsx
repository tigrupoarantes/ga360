import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, CheckCircle, AlertCircle, Clock, Copy, ExternalLink, Server, Code, Terminal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SyncLog {
  id: string;
  sync_type: string;
  records_received: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  errors: any;
}

export function SyncStatus() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [lastSync, setLastSync] = useState<SyncLog | null>(null);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchLogs();
    }
  }, [selectedCompanyId]);

  const fetchLogs = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setLogs(data || []);
      if (data && data.length > 0) {
        setLastSync(data[0]);
      }
    } catch (error) {
      console.error('Error fetching sync logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerRecalculation = async () => {
    if (!selectedCompanyId) return;
    setSyncing(true);

    try {
      const { data, error } = await supabase.functions.invoke('recalculate-goals', {
        body: { company_id: selectedCompanyId }
      });

      if (error) throw error;

      toast.success(`Recálculo concluído: ${data.updated} metas atualizadas`);
      fetchLogs();
    } catch (error: any) {
      console.error('Error triggering recalculation:', error);
      toast.error('Erro ao recalcular metas');
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Sucesso</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500"><AlertCircle className="h-3 w-3 mr-1" /> Parcial</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Falha</Badge>;
      case 'running':
        return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Em execução</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSyncTypeName = (type: string) => {
    switch (type) {
      case 'sales': return 'Vendas';
      case 'sellers': return 'Vendedores';
      case 'distributors': return 'Distribuidoras';
      default: return type;
    }
  };

  const apiEndpoint = `https://aqromdreppgztagafinr.supabase.co/functions/v1/sync-sales`;

  const sqlViewExample = `CREATE VIEW vw_vendas_sync AS
SELECT 
    CONCAT(CONVERT(VARCHAR, data_venda, 112), '_', 
           cod_distribuidora, '_', cod_produto) as external_id,
    cod_distribuidora as distributor_code,
    nome_distribuidora as distributor_name,
    CONVERT(DATE, data_venda) as sale_date,
    cod_produto as product_code,
    nome_produto as product_name,
    categoria as product_category,
    SUM(quantidade) as quantity,
    SUM(valor_total) as total_value,
    COUNT(DISTINCT cod_cliente) as customers_served
FROM vendas_diarias
WHERE data_venda >= DATEADD(DAY, -7, GETDATE())
GROUP BY cod_distribuidora, nome_distribuidora, 
         data_venda, cod_produto, nome_produto, categoria`;

  const powershellScript = `# sync-vendas.ps1
# Configuração
$ApiUrl = "${apiEndpoint}"
$ApiKey = "SUA_SYNC_API_KEY_AQUI"

# Buscar dados do SQL Server
$Query = "SELECT * FROM vw_vendas_sync"
$Sales = Invoke-Sqlcmd -Query $Query -ServerInstance "seu-servidor" -Database "seu-banco"

# Montar payload JSON
$Body = @{
    company_external_id = "${(selectedCompany as any)?.external_id || 'CODIGO_EMPRESA'}"
    sales = $Sales | ForEach-Object {
        @{
            external_id = $_.external_id
            distributor_code = $_.distributor_code
            distributor_name = $_.distributor_name
            sale_date = $_.sale_date.ToString("yyyy-MM-dd")
            product_code = $_.product_code
            product_name = $_.product_name
            product_category = $_.product_category
            quantity = [decimal]$_.quantity
            total_value = [decimal]$_.total_value
            customers_served = [int]$_.customers_served
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

  if (!selectedCompanyId) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Status de Sincronização
              </CardTitle>
              <CardDescription>
                Última sincronização: {lastSync 
                  ? formatDistanceToNow(new Date(lastSync.started_at), { addSuffix: true, locale: ptBR })
                  : 'Nenhuma sincronização realizada'
                }
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              onClick={triggerRecalculation} 
              disabled={syncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Recalcular Metas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : logs.length === 0 ? (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>Aguardando primeira sincronização</AlertTitle>
              <AlertDescription>
                Configure seu SQL Server para enviar dados de vendas para o endpoint abaixo.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">Recebidos</TableHead>
                    <TableHead className="text-center">Criados</TableHead>
                    <TableHead className="text-center">Atualizados</TableHead>
                    <TableHead className="text-center">Falhas</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {format(new Date(log.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{getSyncTypeName(log.sync_type)}</TableCell>
                      <TableCell className="text-center">{log.records_received}</TableCell>
                      <TableCell className="text-center text-green-600">{log.records_created}</TableCell>
                      <TableCell className="text-center text-blue-600">{log.records_updated}</TableCell>
                      <TableCell className="text-center text-red-600">{log.records_failed}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Configuração da Sincronização
          </CardTitle>
          <CardDescription>
            Instruções para configurar o envio automático de dados do SQL Server
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
  "sales": [
    {
      "external_id": "unique_id_per_record",
      "distributor_code": "DIST001",
      "distributor_name": "Nome Distribuidora",
      "sale_date": "2026-01-10",
      "product_code": "PROD001",
      "product_name": "Nome do Produto",
      "product_category": "Categoria",
      "quantity": 150,
      "total_value": 4500.00,
      "customers_served": 25
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
            </TabsContent>

            <TabsContent value="sql" className="space-y-4 mt-4">
              <div>
                <h4 className="font-semibold mb-2">View de Exemplo para SQL Server</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Crie esta view no seu banco de dados para preparar os dados de vendas:
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
                  Adapte a view para corresponder aos nomes das suas tabelas e colunas. 
                  O campo <code>external_id</code> deve ser único por registro para permitir atualizações.
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="script" className="space-y-4 mt-4">
              <div>
                <h4 className="font-semibold mb-2">Script PowerShell para Sincronização</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Use este script para enviar dados do SQL Server para a API. 
                  Configure-o no SQL Agent para execução diária.
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
                    Ver instruções do SQL Agent
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="bg-muted p-4 rounded-md space-y-3">
                    <h5 className="font-semibold">Configurar Job no SQL Agent:</h5>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>Abra o SQL Server Management Studio</li>
                      <li>Expanda SQL Server Agent → Jobs</li>
                      <li>Clique com botão direito → New Job</li>
                      <li>Na aba "General", dê um nome como "Sync Vendas Portal"</li>
                      <li>Na aba "Steps", clique em New e configure:
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li>Type: Operating system (CmdExec)</li>
                          <li>Command: <code>powershell.exe -File "C:\Scripts\sync-vendas.ps1"</code></li>
                        </ul>
                      </li>
                      <li>Na aba "Schedules", configure execução diária às 6h</li>
                      <li>Na aba "Notifications", configure email em caso de falha</li>
                      <li>Clique OK para salvar</li>
                    </ol>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
