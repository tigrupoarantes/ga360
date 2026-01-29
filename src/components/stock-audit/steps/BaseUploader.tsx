import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Download, Lightbulb } from "lucide-react";
import { useStockAudit } from "@/hooks/useStockAudit";
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

interface BaseUploaderProps {
  auditId: string;
  onComplete: (itemCount: number) => void;
  onBack: () => void;
}

const REQUIRED_FIELDS = ["sku_code", "system_qty"];
const OPTIONAL_FIELDS = ["sku_description", "uom", "location"];

const FIELD_LABELS: Record<string, string> = {
  sku_code: "Código SKU",
  system_qty: "Quantidade Sistema",
  sku_description: "Descrição",
  uom: "Unidade de Medida",
  location: "Localização",
};

export function BaseUploader({ auditId, onComplete, onBack }: BaseUploaderProps) {
  const { insertItems } = useStockAudit(auditId);
  
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [delimiter, setDelimiter] = useState(",");
  const [step, setStep] = useState<"upload" | "map">("upload");
  const [importing, setImporting] = useState(false);

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

  const autoDetectMapping = (columns: string[]): ColumnMapping => {
    const mapping: ColumnMapping = {};
    const lowerColumns = columns.map(c => c.toLowerCase());

    // Auto-detect common column names - expanded patterns for ERP compatibility
    const patterns: Record<string, string[]> = {
      sku_code: [
        "codigo", "código", "cod", "sku", "produto", "item", 
        "codprod", "cod_prod", "code", "id_produto"
      ],
      system_qty: [
        "atual", "quantidade", "qtd", "saldo", "estoque", 
        "qty", "qtd_atual", "qtde", "stock", "inventario"
      ],
      sku_description: [
        "descricao", "descrição", "nome", "desc", "description",
        "nome_produto", "produto_nome", "name"
      ],
      uom: [
        "un", "unidade", "um", "uom", "medida", "unit"
      ],
      location: [
        "local", "localizacao", "localização", "endereco", 
        "endereço", "location", "posicao", "end"
      ],
    };

    Object.entries(patterns).forEach(([field, keywords]) => {
      const matchedIndex = lowerColumns.findIndex(col => 
        keywords.some(kw => col.includes(kw))
      );
      if (matchedIndex >= 0) {
        mapping[field] = columns[matchedIndex];
      }
    });

    return mapping;
  };

  const downloadTemplate = () => {
    const csvContent = [
      "CODIGO;DESCRICAO;UNIDADE;QUANTIDADE",
      "SKU001;Produto Exemplo 1;UN;100",
      "SKU002;Produto Exemplo 2;CX;50",
    ].join("\n");
    
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_auditoria_estoque.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

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

    // Auto-detect mapping
    const autoMapping = autoDetectMapping(columns);
    setColumnMapping(autoMapping);

    setStep("map");
  };

  const handleMappingChange = (fieldName: string, csvColumn: string | null) => {
    setColumnMapping(prev => ({ ...prev, [fieldName]: csvColumn }));
  };

  const isValidMapping = () => {
    return REQUIRED_FIELDS.every(field => columnMapping[field]);
  };

  const handleImport = async () => {
    setImporting(true);

    try {
      const itemsData = csvData.map(row => ({
        stock_audit_id: auditId,
        sku_code: columnMapping.sku_code ? row[columnMapping.sku_code] : "",
        sku_description: columnMapping.sku_description ? row[columnMapping.sku_description] || null : null,
        system_qty: columnMapping.system_qty ? parseFloat(row[columnMapping.system_qty]) || 0 : 0,
        uom: columnMapping.uom ? row[columnMapping.uom] || null : null,
        location: columnMapping.location ? row[columnMapping.location] || null : null,
        result: "pending" as const,
        is_in_sample: false,
        physical_qty: null,
        recount_qty: null,
        final_physical_qty: null,
        final_diff_qty: null,
        root_cause_code: null,
        root_cause_notes: null,
        item_notes: null,
        audited_at: null,
      })).filter(item => item.sku_code); // Filter out empty SKUs

      await insertItems.mutateAsync(itemsData);
      onComplete(itemsData.length);
    } catch (error) {
      console.error("Import error:", error);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Base do Estoque</h2>
        <p className="text-muted-foreground mt-1">
          Importe o arquivo com a base de estoque atual
        </p>
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          {/* Template Download Section */}
          <Card className="bg-muted/50">
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Lightbulb className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Precisa de um modelo?</p>
                  <p className="text-sm text-muted-foreground">
                    Preencha com os dados do seu ERP e importe aqui
                  </p>
                </div>
                <Button variant="outline" onClick={downloadTemplate} className="flex-shrink-0">
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Template CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Upload Section */}
          <Card className="border-2 border-dashed">
            <CardContent className="py-12">
              <div className="text-center">
                <FileSpreadsheet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <Label htmlFor="csv-upload" className="cursor-pointer">
                  <span className="text-lg font-medium text-primary hover:underline">
                    Clique para selecionar
                  </span>
                  <span className="text-muted-foreground"> ou arraste um arquivo</span>
                </Label>
                <p className="text-sm text-muted-foreground mt-2">
                  Formatos aceitos: CSV, XLS, XLSX
                </p>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv,.txt,.xls,.xlsx"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Arquivo carregado: {file?.name}
            </CardTitle>
            <CardDescription>
              {csvData.length} itens encontrados. Confirme o mapeamento das colunas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Auto-detected mapping info */}
            {Object.keys(columnMapping).length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Mapeamento detectado automaticamente. Revise e ajuste se necessário.
                </AlertDescription>
              </Alert>
            )}

            {/* Column mapping */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => (
                <div key={field} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {FIELD_LABELS[field]}
                    {REQUIRED_FIELDS.includes(field) && (
                      <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                    )}
                  </Label>
                  <Select
                    value={columnMapping[field] || ""}
                    onValueChange={(value) => handleMappingChange(field, value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvColumns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview */}
            {csvData.length > 0 && (
              <div className="space-y-2">
                <Label>Preview (5 primeiros itens)</Label>
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Qtd Sistema</TableHead>
                        <TableHead>UM</TableHead>
                        <TableHead>Local</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono">
                            {columnMapping.sku_code ? row[columnMapping.sku_code] : "-"}
                          </TableCell>
                          <TableCell>
                            {columnMapping.sku_description ? row[columnMapping.sku_description] : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {columnMapping.system_qty ? row[columnMapping.system_qty] : "-"}
                          </TableCell>
                          <TableCell>
                            {columnMapping.uom ? row[columnMapping.uom] : "-"}
                          </TableCell>
                          <TableCell>
                            {columnMapping.location ? row[columnMapping.location] : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        
        {step === "map" && (
          <Button 
            onClick={handleImport} 
            disabled={!isValidMapping() || importing}
            size="lg"
          >
            {importing ? "Importando..." : `Importar ${csvData.length} itens`}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
