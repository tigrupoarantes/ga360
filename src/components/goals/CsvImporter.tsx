import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/external-client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, ArrowRight, Save, Target } from "lucide-react";
import { CsvColumnMapper } from "./CsvColumnMapper";
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

const REQUIRED_FIELDS = ["name", "target_value", "start_date", "end_date"];
const OPTIONAL_FIELDS = ["current_value", "goal_type", "area", "notes"];

export function CsvImporter() {
  const { selectedCompanyId } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<"upload" | "map" | "preview" | "result">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [delimiter, setDelimiter] = useState(",");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] }>({ success: 0, errors: [] });
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [goalTypes, setGoalTypes] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);

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

    // Load templates and reference data
    if (selectedCompanyId) {
      const [templatesRes, typesRes, areasRes] = await Promise.all([
        supabase.from("csv_import_templates").select("*").eq("company_id", selectedCompanyId),
        supabase.from("goal_types").select("*").eq("company_id", selectedCompanyId).eq("is_active", true),
        supabase.from("areas").select("*").eq("company_id", selectedCompanyId),
      ]);
      
      if (templatesRes.data) setTemplates(templatesRes.data);
      if (typesRes.data) setGoalTypes(typesRes.data);
      if (areasRes.data) setAreas(areasRes.data);
    }

    setStep("map");
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template?.column_mapping) {
      setColumnMapping(template.column_mapping as ColumnMapping);
    }
  };

  const handleMappingChange = (fieldName: string, csvColumn: string | null) => {
    setColumnMapping(prev => ({ ...prev, [fieldName]: csvColumn }));
  };

  const isValidMapping = () => {
    return REQUIRED_FIELDS.every(field => columnMapping[field]);
  };

  const handleSaveTemplate = async () => {
    if (!selectedCompanyId || !user) return;

    const name = prompt("Nome do template:");
    if (!name) return;

    const { error } = await supabase.from("csv_import_templates").insert({
      company_id: selectedCompanyId,
      name,
      column_mapping: columnMapping,
      delimiter,
      created_by: user.id,
    });

    if (error) {
      toast({ title: "Erro ao salvar template", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Template salvo com sucesso" });
    }
  };

  const handleImport = async () => {
    if (!selectedCompanyId || !user) return;

    setImporting(true);
    const errors: string[] = [];
    let successCount = 0;

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNum = i + 2; // +2 for header and 1-indexed

      try {
        const name = columnMapping.name ? row[columnMapping.name] : null;
        const targetValue = columnMapping.target_value ? parseFloat(row[columnMapping.target_value]) : null;
        const startDate = columnMapping.start_date ? row[columnMapping.start_date] : null;
        const endDate = columnMapping.end_date ? row[columnMapping.end_date] : null;
        const currentValue = columnMapping.current_value ? parseFloat(row[columnMapping.current_value]) || 0 : 0;

        if (!name || !targetValue || !startDate || !endDate) {
          errors.push(`Linha ${rowNum}: Campos obrigatórios faltando`);
          continue;
        }

        // Find goal_type_id if mapped
        let goalTypeId = null;
        if (columnMapping.goal_type && row[columnMapping.goal_type]) {
          const typeName = row[columnMapping.goal_type].toLowerCase();
          const foundType = goalTypes.find(t => t.name.toLowerCase() === typeName);
          if (foundType) goalTypeId = foundType.id;
        }

        // Find area_id if mapped
        let areaId = null;
        if (columnMapping.area && row[columnMapping.area]) {
          const areaName = row[columnMapping.area].toLowerCase();
          const foundArea = areas.find(a => a.name.toLowerCase() === areaName);
          if (foundArea) areaId = foundArea.id;
        }

        const { error } = await supabase.from("goals").insert({
          company_id: selectedCompanyId,
          name,
          target_value: targetValue,
          current_value: currentValue,
          start_date: startDate,
          end_date: endDate,
          goal_type_id: goalTypeId,
          area_id: areaId,
          notes: columnMapping.notes ? row[columnMapping.notes] || null : null,
          created_by: user.id,
        });

        if (error) {
          errors.push(`Linha ${rowNum}: ${error.message}`);
        } else {
          successCount++;
        }
      } catch (err: any) {
        errors.push(`Linha ${rowNum}: ${err.message}`);
      }
    }

    setImporting(false);
    setImportResult({ success: successCount, errors });
    setStep("result");
  };

  const resetImporter = () => {
    setStep("upload");
    setFile(null);
    setCsvData([]);
    setCsvColumns([]);
    setColumnMapping({});
    setImportResult({ success: 0, errors: [] });
  };

  if (!selectedCompanyId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecione uma empresa para importar metas via CSV</p>
        </CardContent>
      </Card>
    );
  }

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
              Selecione um arquivo CSV com suas metas. O sistema detectará automaticamente as colunas.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle>Mapeamento de Colunas</CardTitle>
            <CardDescription>
              Associe as colunas do seu CSV aos campos do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {templates.length > 0 && (
              <div className="space-y-2">
                <Label>Usar template salvo</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <CsvColumnMapper
              csvColumns={csvColumns}
              columnMapping={columnMapping}
              onMappingChange={handleMappingChange}
              requiredFields={REQUIRED_FIELDS}
              optionalFields={OPTIONAL_FIELDS}
            />

            {/* Preview */}
            {csvData.length > 0 && (
              <div className="space-y-2">
                <Label>Preview dos dados (5 primeiras linhas)</Label>
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {csvColumns.map(col => (
                          <TableHead key={col}>{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          {csvColumns.map(col => (
                            <TableCell key={col}>{row[col]}</TableCell>
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
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSaveTemplate}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Template
                </Button>
                <Button onClick={() => setStep("preview")} disabled={!isValidMapping()}>
                  Continuar
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Confirmar Importação</CardTitle>
            <CardDescription>
              {csvData.length} metas serão importadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Revise o mapeamento antes de confirmar. Esta ação criará novas metas no sistema.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Mapeamento configurado:</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(columnMapping).filter(([_, v]) => v).map(([field, col]) => (
                  <Badge key={field} variant="secondary">
                    {field}: {col}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("map")}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importando..." : `Importar ${csvData.length} metas`}
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
                  <p className="text-sm text-muted-foreground">metas importadas com sucesso</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-red-600">{importResult.errors.length}</p>
                  <p className="text-sm text-muted-foreground">erros encontrados</p>
                </CardContent>
              </Card>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <Label>Erros:</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                  {importResult.errors.map((err, idx) => (
                    <Alert key={idx} variant="destructive" className="py-2">
                      <AlertDescription>{err}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={resetImporter} className="w-full">
              Nova Importação
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
