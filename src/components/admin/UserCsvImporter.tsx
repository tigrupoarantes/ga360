import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/external-client";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, ArrowRight, Download, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CsvRow {
  [key: string]: string;
}

interface ColumnMapping {
  [fieldName: string]: string | null;
}

interface ImportResult {
  success: number;
  errors: { row: number; message: string }[];
}

const REQUIRED_FIELDS = ["email", "first_name", "last_name", "company", "role", "phone"];
const OPTIONAL_FIELDS = ["area"];

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  first_name: "Nome",
  last_name: "Sobrenome",
  company: "Empresa",
  role: "Role",
  phone: "Telefone",
  area: "Área",
};

const VALID_ROLES = ["super_admin", "ceo", "diretor", "gerente", "colaborador"];

interface UserCsvImporterProps {
  onComplete: () => void;
}

export function UserCsvImporter({ onComplete }: UserCsvImporterProps) {
  const { toast } = useToast();
  
  const [step, setStep] = useState<"upload" | "map" | "preview" | "result">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [delimiter, setDelimiter] = useState(",");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult>({ success: 0, errors: [] });

  const detectDelimiter = (text: string): string => {
    const firstLine = text.split('\n')[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    
    if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
    if (semicolonCount > commaCount) return ';';
    return ',';
  };

  const parseCSV = useCallback((text: string, delim: string): { columns: string[]; data: CsvRow[] } => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { columns: [], data: [] };

    const columns = lines[0].split(delim).map(col => col.trim().replace(/^"|"$/g, ''));
    const data: CsvRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delim).map(val => val.trim().replace(/^"|"$/g, ''));
      const row: CsvRow = {};
      columns.forEach((col, idx) => {
        row[col] = values[idx] || '';
      });
      data.push(row);
    }

    return { columns, data };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    
    const text = await selectedFile.text();
    const detectedDelimiter = detectDelimiter(text);
    setDelimiter(detectedDelimiter);
    
    const { columns, data } = parseCSV(text, detectedDelimiter);
    setCsvColumns(columns);
    setCsvData(data);

    // Try to auto-map columns
    const autoMapping: ColumnMapping = {};
    columns.forEach(col => {
      const colLower = col.toLowerCase().replace(/[_\-\s]/g, '');
      if (colLower.includes('email')) autoMapping.email = col;
      else if (colLower.includes('nome') && !colLower.includes('sobre')) autoMapping.first_name = col;
      else if (colLower.includes('first') || colLower.includes('primeiro')) autoMapping.first_name = col;
      else if (colLower.includes('sobrenome') || colLower.includes('last')) autoMapping.last_name = col;
      else if (colLower.includes('empresa') || colLower.includes('company')) autoMapping.company = col;
      else if (colLower.includes('role') || colLower.includes('cargo') || colLower.includes('funcao')) autoMapping.role = col;
      else if (colLower.includes('telefone') || colLower.includes('phone') || colLower.includes('celular')) autoMapping.phone = col;
      else if (colLower.includes('area') || colLower.includes('departamento') || colLower.includes('setor')) autoMapping.area = col;
    });
    setColumnMapping(autoMapping);

    setStep("map");
  };

  const handleMappingChange = (fieldName: string, csvColumn: string | null) => {
    setColumnMapping(prev => ({ ...prev, [fieldName]: csvColumn }));
  };

  const isValidMapping = () => {
    return REQUIRED_FIELDS.every(field => columnMapping[field]);
  };

  const validateRow = (row: CsvRow, rowNum: number): string[] => {
    const errors: string[] = [];
    
    // Validate email
    const email = columnMapping.email ? row[columnMapping.email] : '';
    if (!email || !email.includes('@')) {
      errors.push(`Email inválido`);
    }
    
    // Validate role
    const role = columnMapping.role ? row[columnMapping.role]?.toLowerCase() : '';
    if (!VALID_ROLES.includes(role)) {
      errors.push(`Role inválida (use: ${VALID_ROLES.join(', ')})`);
    }
    
    // Validate required fields
    const firstName = columnMapping.first_name ? row[columnMapping.first_name] : '';
    const lastName = columnMapping.last_name ? row[columnMapping.last_name] : '';
    const company = columnMapping.company ? row[columnMapping.company] : '';
    const phone = columnMapping.phone ? row[columnMapping.phone] : '';
    
    if (!firstName) errors.push(`Nome obrigatório`);
    if (!lastName) errors.push(`Sobrenome obrigatório`);
    if (!company) errors.push(`Empresa obrigatória`);
    if (!phone) errors.push(`Telefone obrigatório`);
    
    return errors;
  };

  const getPreviewValidation = (): { valid: number; invalid: number; errors: { row: number; messages: string[] }[] } => {
    let valid = 0;
    let invalid = 0;
    const errors: { row: number; messages: string[] }[] = [];
    
    csvData.forEach((row, idx) => {
      const rowErrors = validateRow(row, idx + 2);
      if (rowErrors.length > 0) {
        invalid++;
        errors.push({ row: idx + 2, messages: rowErrors });
      } else {
        valid++;
      }
    });
    
    return { valid, invalid, errors };
  };

  const handleImport = async () => {
    setImporting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      // Prepare users data for edge function
      const users = csvData.map((row, idx) => ({
        row_number: idx + 2,
        email: columnMapping.email ? row[columnMapping.email]?.trim() : '',
        first_name: columnMapping.first_name ? row[columnMapping.first_name]?.trim() : '',
        last_name: columnMapping.last_name ? row[columnMapping.last_name]?.trim() : '',
        company_name: columnMapping.company ? row[columnMapping.company]?.trim() : '',
        role: columnMapping.role ? row[columnMapping.role]?.toLowerCase().trim() : '',
        phone: columnMapping.phone ? row[columnMapping.phone]?.trim() : '',
        area_name: columnMapping.area ? row[columnMapping.area]?.trim() : null,
      }));

      const response = await supabase.functions.invoke('import-users', {
        body: { users },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data as ImportResult;
      setImportResult(result);
      setStep("result");
      
      if (result.success > 0) {
        toast({
          title: 'Importação concluída!',
          description: `${result.success} usuários importados com sucesso.`,
        });
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: 'Erro na importação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['email', 'nome', 'sobrenome', 'empresa', 'role', 'telefone', 'area'];
    const example = ['joao@empresa.com', 'João', 'Silva', 'Empresa A', 'colaborador', '+5511999999999', 'Comercial'];
    const csv = [headers.join(';'), example.join(';')].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_usuarios.csv';
    link.click();
  };

  const resetImporter = () => {
    setStep("upload");
    setFile(null);
    setCsvData([]);
    setCsvColumns([]);
    setColumnMapping({});
    setImportResult({ success: 0, errors: [] });
  };

  const validation = step === "preview" ? getPreviewValidation() : null;

  return (
    <div className="space-y-6">
      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2">
        {["upload", "map", "preview", "result"].map((s, idx) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s ? "bg-primary text-primary-foreground" : 
              ["upload", "map", "preview", "result"].indexOf(step) > idx 
                ? "bg-primary/20 text-primary" 
                : "bg-muted text-muted-foreground"
            }`}>
              {idx + 1}
            </div>
            {idx < 3 && <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload do Arquivo CSV
            </CardTitle>
            <CardDescription>
              Selecione um arquivo CSV com os dados dos usuários
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <span className="text-primary hover:underline">Clique para selecionar</span>
                <span className="text-muted-foreground"> ou arraste um arquivo CSV</span>
              </Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            
            <div className="flex justify-center">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Template CSV
              </Button>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Campos obrigatórios:</strong> email, nome, sobrenome, empresa, role, telefone<br />
                <strong>Campo opcional:</strong> área<br />
                <strong>Roles válidas:</strong> super_admin, ceo, diretor, gerente, colaborador
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle>Mapeamento de Colunas</CardTitle>
            <CardDescription>
              Associe as colunas do seu CSV aos campos do sistema. Arquivo: {file?.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map(field => (
                <div key={field} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {FIELD_LABELS[field]}
                    {REQUIRED_FIELDS.includes(field) && (
                      <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                    )}
                  </Label>
                  <Select 
                    value={columnMapping[field] || ""} 
                    onValueChange={(v) => handleMappingChange(field, v || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Não mapear</SelectItem>
                      {csvColumns.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview */}
            {csvData.length > 0 && (
              <div className="space-y-2">
                <Label>Preview dos dados (5 primeiras linhas)</Label>
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {csvColumns.map(col => (
                          <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          {csvColumns.map(col => (
                            <TableCell key={col} className="whitespace-nowrap">{row[col]}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={resetImporter}>
                Voltar
              </Button>
              <Button onClick={() => setStep("preview")} disabled={!isValidMapping()}>
                Continuar
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && validation && (
        <Card>
          <CardHeader>
            <CardTitle>Confirmar Importação</CardTitle>
            <CardDescription>
              {csvData.length} usuários encontrados no arquivo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-green-500/10 border-green-500/20">
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-green-600">{validation.valid}</p>
                  <p className="text-sm text-muted-foreground">usuários válidos</p>
                </CardContent>
              </Card>
              <Card className="bg-destructive/10 border-destructive/20">
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-destructive">{validation.invalid}</p>
                  <p className="text-sm text-muted-foreground">com erros</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              <Label>Mapeamento configurado:</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(columnMapping).filter(([_, v]) => v).map(([field, col]) => (
                  <Badge key={field} variant="secondary">
                    {FIELD_LABELS[field]}: {col}
                  </Badge>
                ))}
              </div>
            </div>

            {validation.errors.length > 0 && (
              <div className="space-y-2">
                <Label>Erros de validação (primeiros 10):</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                  {validation.errors.slice(0, 10).map((err, idx) => (
                    <Alert key={idx} variant="destructive" className="py-2">
                      <AlertDescription>
                        Linha {err.row}: {err.messages.join(', ')}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Apenas usuários válidos serão importados. Um email de boas-vindas será enviado para cada usuário criado.
              </AlertDescription>
            </Alert>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("map")}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={importing || validation.valid === 0}>
                {importing ? "Importando..." : `Importar ${validation.valid} usuários`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Result */}
      {step === "result" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Importação Concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-green-600">{importResult.success}</p>
                  <p className="text-sm text-muted-foreground">usuários importados</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-destructive">{importResult.errors.length}</p>
                  <p className="text-sm text-muted-foreground">erros</p>
                </CardContent>
              </Card>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <Label>Erros:</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                  {importResult.errors.map((err, idx) => (
                    <Alert key={idx} variant="destructive" className="py-2">
                      <AlertDescription>
                        Linha {err.row}: {err.message}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={resetImporter} variant="outline" className="flex-1">
                Nova Importação
              </Button>
              <Button onClick={onComplete} className="flex-1">
                <Users className="h-4 w-4 mr-2" />
                Ver Usuários
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
