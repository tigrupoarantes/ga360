import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle,
  UserMinus, Download, FileDown, Plus, RefreshCw, ArrowRight,
  AlertTriangle, RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/external-client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// CSV Template
const CSV_HEADERS = ['CPF', 'NOME', 'EMAIL', 'TELEFONE', 'CARGO', 'DEPARTAMENTO', 'EMPRESA', 'ATIVO', 'COD_VENDEDOR'];
const CSV_EXAMPLE_ROWS = [
  ['12345678901', 'Maria da Silva', 'maria@email.com', '11999999999', 'Analista', 'Financeiro', 'Empresa ABC', 'Ativo', ''],
  ['98765432100', 'João Santos', 'joao@email.com', '11988888888', 'Gerente', 'TI', 'Empresa XYZ', 'Ativo', '123'],
];

const downloadCsv = (content: string, filename: string) => {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

const downloadTemplate = () => {
  const csvContent = [CSV_HEADERS.join(';'), ...CSV_EXAMPLE_ROWS.map(row => row.join(';'))].join('\n');
  downloadCsv(csvContent, 'modelo_funcionarios.csv');
  toast.success('Modelo CSV baixado!');
};

// Normalize CPF
const normalizeCpf = (cpf: string) => {
  const digits = cpf?.replace(/\D/g, '') || '';
  if (!digits) return '';
  return digits.padStart(11, '0');
};

// CSV line parser
const parseCSVLine = (line: string): string[] => {
  if (line.includes("','")) {
    const parts = line.split("','");
    return parts.map((v, idx) => {
      let cleaned = v.trim();
      if (idx === parts.length - 1) cleaned = cleaned.replace(/'$/, '');
      cleaned = cleaned.replace(/^['"]|['"]$/g, '');
      return cleaned.trim();
    });
  }
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if ((char === '"' || char === "'") && (!inQuotes || char === quoteChar)) {
      if (!inQuotes) { inQuotes = true; quoteChar = char; }
      else { inQuotes = false; quoteChar = ''; }
    } else if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map(v => v.replace(/^['"]|['"]$/g, ''));
};

const headerMappings: Record<string, string> = {
  'cpf': 'cpf', 'cpffuncionario': 'cpf', 'cpf_funcionario': 'cpf',
  'nome': 'nome', 'nomefuncionario': 'nome', 'nome_funcionario': 'nome', 'funcionario': 'nome',
  'email': 'email', 'e_mail': 'email',
  'telefone': 'telefone', 'tel': 'telefone', 'celular': 'telefone',
  'cargo': 'cargo', 'descricaocargo': 'cargo', 'funcao': 'cargo', 'posicao': 'cargo',
  'departamento': 'departamento', 'centrodecusto': 'departamento', 'depto': 'departamento', 'setor': 'departamento',
  'empresa': 'empresa', 'companhia': 'empresa',
  'ativo': 'ativo', 'situacao': 'ativo', 'status': 'ativo',
  'codigo_vendedor': 'codigo_vendedor', 'codigovendedor': 'codigo_vendedor', 'cod_vendedor': 'codigo_vendedor',
  'is_condutor': 'is_condutor', 'condutor': 'is_condutor',
  'cnh_numero': 'cnh_numero', 'cnh': 'cnh_numero',
  'cnh_categoria': 'cnh_categoria', 'categoria_cnh': 'cnh_categoria',
  'cnh_validade': 'cnh_validade', 'validade_cnh': 'cnh_validade',
};

interface CsvRow {
  cpf: string;
  nome?: string;
  email?: string;
  telefone?: string;
  cargo?: string;
  departamento?: string;
  empresa?: string;
  ativo?: string;
  is_condutor?: string;
  cnh_numero?: string;
  cnh_categoria?: string;
  cnh_validade?: string;
  codigo_vendedor?: string;
  [key: string]: string | undefined;
}

interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

interface PreviewRecord {
  cpf: string;
  nome: string;
  action: 'insert' | 'update' | 'deactivate' | 'skip' | 'reactivate';
  changes?: FieldChange[];
  row: CsvRow;
  existingData?: any;
}

interface EmployeeToDeactivate {
  id: string;
  cpf: string;
  nome: string;
}

interface ImportResult {
  total: number;
  updated: number;
  created: number;
  skipped: number;
  deactivated: number;
  reactivated: number;
  errors: string[];
}

type ImportMode = 'update-only' | 'full-sync';

const fieldLabels: Record<string, string> = {
  full_name: 'Nome', email: 'Email', phone: 'Telefone',
  position: 'Cargo', department: 'Departamento', company_id: 'Empresa',
  is_condutor: 'Condutor', cnh_numero: 'CNH Número', cnh_categoria: 'CNH Categoria',
  cnh_validade: 'CNH Validade', cod_vendedor: 'Cód. Vendedor',
};

// Consolidate by CPF
const consolidateByCpf = (rows: CsvRow[]) => {
  const cpfMap = new Map<string, CsvRow[]>();
  rows.forEach(row => {
    const cpf = normalizeCpf(row.cpf);
    if (!cpf || cpf.length !== 11) return;
    if (!cpfMap.has(cpf)) cpfMap.set(cpf, []);
    cpfMap.get(cpf)!.push(row);
  });
  const consolidated: CsvRow[] = [];
  cpfMap.forEach(cpfRows => {
    const hasActive = cpfRows.some(r => {
      if (!r.ativo) return true;
      return ['sim', 'ativo', 'yes', 'true', '1', 's'].includes(r.ativo.toLowerCase());
    });
    const base = cpfRows.find(r => {
      if (!r.ativo) return true;
      return ['sim', 'ativo', 'yes', 'true', '1', 's'].includes(r.ativo.toLowerCase());
    }) || cpfRows[0];
    consolidated.push({ ...base, ativo: hasActive ? 'Ativo' : 'Inativo' });
  });
  return {
    consolidated,
    info: {
      originalCount: rows.length,
      uniqueCount: consolidated.length,
      duplicatesConsolidated: rows.length - consolidated.length,
    },
  };
};

const parseWithHeader = (lines: string[], headerLineIndex: number): CsvRow[] => {
  const rawHeaders = parseCSVLine(lines[headerLineIndex]);
  const headers = rawHeaders.map(h =>
    h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['"]/g, '')
  );
  const rows: CsvRow[] = [];
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const mapped: CsvRow = { cpf: '' };
    headers.forEach((header, idx) => {
      const target = headerMappings[header] || headerMappings[header.replace(/_/g, '')];
      if (target) mapped[target] = values[idx] || '';
    });
    if (mapped.cpf) rows.push(mapped);
  }
  return rows;
};

const parseWithFixedColumns = (lines: string[]): CsvRow[] => {
  const rows: CsvRow[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const values = parseCSVLine(line);
    if (values.length < 2) continue;
    const row: CsvRow = {
      nome: values[0] || '', cpf: values[1] || '', cargo: values[2] || '',
      departamento: values[3] || '', empresa: values[4] || '', ativo: values[5] || 'Ativo',
    };
    if (row.cpf) rows.push(row);
  }
  return rows;
};

const parseCsv = (text: string): CsvRow[] => {
  const lines = text.trim().split('\n');
  if (lines.length < 1) return [];
  const firstValues = parseCSVLine(lines[0]);
  const looksLikeHeader = firstValues.some(v => {
    const lower = v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return ['cpf', 'nome', 'cargo', 'empresa', 'situacao', 'ativo', 'funcionario',
      'departamento', 'email', 'telefone'].some(h => lower.includes(h));
  });
  if (looksLikeHeader) {
    let idx = 0;
    if (lines[0].startsWith("'") || lines[0].includes("\"'")) { idx = 1; if (lines.length < 3) return []; }
    return parseWithHeader(lines, idx);
  }
  return parseWithFixedColumns(lines);
};

interface ImportEmployeesDialogProps {
  onComplete: () => void;
}

export function ImportEmployeesDialog({ onComplete }: ImportEmployeesDialogProps) {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<CsvRow[]>([]);
  const [previewRecords, setPreviewRecords] = useState<PreviewRecord[]>([]);
  const [consolidationInfo, setConsolidationInfo] = useState<{ originalCount: number; uniqueCount: number; duplicatesConsolidated: number } | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('update-only');
  const [toDeactivateList, setToDeactivateList] = useState<EmployeeToDeactivate[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const analyzePreview = async (rows: CsvRow[], mode: ImportMode) => {
    setIsAnalyzing(true);
    try {
      const { data: companiesData } = await supabase.from('companies').select('id, name').eq('is_active', true);
      const companiesMap = new Map((companiesData || []).map(c => [c.name.toLowerCase(), c]));
      const companiesIdMap = new Map((companiesData || []).map(c => [c.id, c.name]));

      const cpfList = rows.map(r => normalizeCpf(r.cpf)).filter(cpf => cpf && cpf.length === 11);
      const csvCpfsSet = new Set(cpfList);

      // Fetch existing by CPF
      const { data: existingEmployees } = await supabase
        .from('external_employees')
        .select('id, cpf, full_name, email, phone, position, department, company_id, is_active, cod_vendedor, is_condutor, cnh_numero, cnh_categoria, cnh_validade, external_id')
        .in('cpf', cpfList);

      const existingMap = new Map((existingEmployees || []).map(e => [e.cpf!, e]));

      // Full-sync: find who will be deactivated
      let willDeactivate: EmployeeToDeactivate[] = [];
      if (mode === 'full-sync') {
        const { data: allActive } = await supabase
          .from('external_employees')
          .select('id, cpf, full_name')
          .eq('is_active', true)
          .not('cpf', 'is', null)
          .neq('cpf', '');
        willDeactivate = (allActive || []).filter(emp => {
          const n = normalizeCpf(emp.cpf || '');
          return n && !csvCpfsSet.has(n);
        }).map(emp => ({ id: emp.id, cpf: emp.cpf || '', nome: emp.full_name }));
      }
      setToDeactivateList(willDeactivate);

      const records: PreviewRecord[] = [];
      for (const row of rows) {
        const cpf = normalizeCpf(row.cpf);
        if (!cpf || cpf.length !== 11) {
          records.push({ cpf: row.cpf, nome: row.nome || '-', action: 'skip', row });
          continue;
        }
        let isActiveInCsv = true;
        if (row.ativo) {
          isActiveInCsv = ['sim', 'ativo', 'yes', 'true', '1', 's'].includes(row.ativo.toLowerCase());
        }
        const existing = existingMap.get(cpf);
        if (!isActiveInCsv) {
          if (existing) {
            records.push({ cpf, nome: existing.full_name || row.nome || '-', action: 'deactivate', row, existingData: existing });
          } else {
            records.push({ cpf, nome: row.nome || '-', action: 'skip', row });
          }
          continue;
        }
        if (existing) {
          const isReactivation = existing.is_active === false;
          const changes: FieldChange[] = [];
          if (row.nome && row.nome.toUpperCase() !== (existing.full_name || '').toUpperCase())
            changes.push({ field: 'full_name', oldValue: existing.full_name || '', newValue: row.nome.toUpperCase() });
          if (row.email && row.email.toLowerCase() !== (existing.email || '').toLowerCase())
            changes.push({ field: 'email', oldValue: existing.email || '', newValue: row.email.toLowerCase() });
          if (row.telefone && row.telefone !== (existing.phone || ''))
            changes.push({ field: 'phone', oldValue: existing.phone || '', newValue: row.telefone });
          if (row.cargo && row.cargo.toUpperCase() !== (existing.position || '').toUpperCase())
            changes.push({ field: 'position', oldValue: existing.position || '', newValue: row.cargo.toUpperCase() });
          if (row.departamento && row.departamento.toUpperCase() !== (existing.department || '').toUpperCase())
            changes.push({ field: 'department', oldValue: existing.department || '', newValue: row.departamento.toUpperCase() });
          if (row.empresa) {
            const info = companiesMap.get(row.empresa.toLowerCase());
            if (info && info.id !== existing.company_id) {
              changes.push({ field: 'company_id', oldValue: companiesIdMap.get(existing.company_id || '') || '', newValue: info.name });
            }
          }
          if (row.codigo_vendedor) {
            const codigo = row.codigo_vendedor.replace(/\D/g, '');
            if (codigo && codigo !== (existing.cod_vendedor || ''))
              changes.push({ field: 'cod_vendedor', oldValue: existing.cod_vendedor || '', newValue: codigo });
          }
          records.push({
            cpf, nome: row.nome?.toUpperCase() || existing.full_name || '-',
            action: isReactivation ? 'reactivate' : 'update',
            changes: changes.length > 0 ? changes : undefined, row, existingData: existing,
          });
        } else {
          records.push({ cpf, nome: row.nome?.toUpperCase() || 'SEM NOME', action: 'insert', row });
        }
      }
      setPreviewRecords(records);
    } catch (error) {
      console.error('Error analyzing preview:', error);
      toast.error('Erro ao analisar prévia');
    }
    setIsAnalyzing(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) { toast.error("Arquivo CSV vazio ou formato inválido"); return; }
      const { consolidated, info } = consolidateByCpf(rows);
      setPreviewData(consolidated);
      setConsolidationInfo(info);
      setResult(null);
      setPreviewRecords([]);
      setToDeactivateList([]);
      await analyzePreview(consolidated, importMode);
    } catch {
      toast.error("Erro ao ler arquivo CSV");
    }
  };

  const handleImportModeChange = async (mode: ImportMode) => {
    setImportMode(mode);
    if (previewData.length > 0) await analyzePreview(previewData, mode);
  };

  const processImport = async () => {
    if (previewData.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    const result: ImportResult = { total: previewData.length, updated: 0, created: 0, skipped: 0, deactivated: 0, reactivated: 0, errors: [] };

    const { data: companiesData } = await supabase.from('companies').select('id, name').eq('is_active', true);
    const companiesMap = new Map((companiesData || []).map(c => [c.name.toLowerCase(), c.id]));

    for (let i = 0; i < previewData.length; i++) {
      const row = previewData[i];
      const cpf = normalizeCpf(row.cpf);
      if (!cpf || cpf.length !== 11) {
        result.errors.push(`Linha ${i + 2}: CPF inválido "${row.cpf}"`);
        result.skipped++;
        setProgress(((i + 1) / previewData.length) * 100);
        continue;
      }
      try {
        const { data: existing } = await supabase
          .from('external_employees')
          .select('id, is_active')
          .eq('cpf', cpf)
          .maybeSingle();

        let isActiveInCsv = true;
        if (row.ativo) {
          isActiveInCsv = ['sim', 'ativo', 'yes', 'true', '1', 's'].includes(row.ativo.toLowerCase());
        }

        if (!isActiveInCsv) {
          if (existing) {
            await supabase.from('external_employees').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', existing.id);
            result.deactivated++;
          } else {
            result.skipped++;
          }
          setProgress(((i + 1) / previewData.length) * 100);
          continue;
        }

        const updateData: Record<string, any> = { is_active: true, updated_at: new Date().toISOString() };
        if (row.nome) updateData.full_name = row.nome.toUpperCase();
        if (row.email) updateData.email = row.email.toLowerCase();
        if (row.telefone) updateData.phone = row.telefone;
        if (row.cargo) updateData.position = row.cargo.toUpperCase();
        if (row.departamento) updateData.department = row.departamento.toUpperCase();
        if (row.empresa) {
          const companyId = companiesMap.get(row.empresa.toLowerCase());
          if (companyId) updateData.company_id = companyId;
        }
        if (row.codigo_vendedor) {
          const codigo = row.codigo_vendedor.replace(/\D/g, '');
          if (codigo) updateData.cod_vendedor = codigo;
        }
        if (row.is_condutor) {
          updateData.is_condutor = ['sim', 'yes', 'true', '1', 's'].includes(row.is_condutor.toLowerCase());
        }
        if (row.cnh_numero) updateData.cnh_numero = row.cnh_numero;
        if (row.cnh_categoria) updateData.cnh_categoria = row.cnh_categoria.toUpperCase();
        if (row.cnh_validade) updateData.cnh_validade = row.cnh_validade;

        if (existing) {
          const wasInactive = existing.is_active === false;
          const { error } = await supabase.from('external_employees').update(updateData).eq('id', existing.id);
          if (error) throw error;
          if (wasInactive) result.reactivated++; else result.updated++;
        } else {
          const { error } = await supabase.from('external_employees').insert({
            cpf,
            external_id: `csv-import-${cpf}`,
            source_system: 'csv-import',
            full_name: row.nome?.toUpperCase() || 'SEM NOME',
            ...updateData,
          });
          if (error) throw error;
          result.created++;
        }
      } catch (error: any) {
        result.errors.push(`Linha ${i + 2}: ${error.message}`);
        result.skipped++;
      }
      setProgress(((i + 1) / previewData.length) * 100);
    }

    // Full-sync deactivation
    if (importMode === 'full-sync') {
      const importedCpfs = new Set<string>();
      previewData.forEach(row => {
        const cpf = normalizeCpf(row.cpf);
        if (cpf && cpf.length === 11) importedCpfs.add(cpf);
      });
      const { data: activeEmployees } = await supabase
        .from('external_employees')
        .select('id, cpf, full_name')
        .eq('is_active', true)
        .not('cpf', 'is', null)
        .neq('cpf', '');
      if (activeEmployees) {
        const toDeactivate = activeEmployees.filter(emp => {
          const n = normalizeCpf(emp.cpf || '');
          return n && !importedCpfs.has(n);
        });
        for (const emp of toDeactivate) {
          try {
            await supabase.from('external_employees').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', emp.id);
            result.deactivated++;
          } catch (error: any) {
            result.errors.push(`Erro ao desativar ${emp.full_name}: ${error.message}`);
          }
        }
      }
    }

    setResult(result);
    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["external-employees"] });

    if (result.errors.length === 0) {
      const parts = [];
      if (result.updated > 0) parts.push(`${result.updated} atualizados`);
      if (result.created > 0) parts.push(`${result.created} criados`);
      if (result.reactivated > 0) parts.push(`${result.reactivated} reativados`);
      if (result.deactivated > 0) parts.push(`${result.deactivated} inativados`);
      toast.success(`Importação concluída: ${parts.join(', ')}`);
    } else {
      toast.warning(`Importação concluída com ${result.errors.length} erros`);
    }
    onComplete();
  };

  const handleClose = () => {
    setOpen(false);
    setPreviewData([]);
    setPreviewRecords([]);
    setConsolidationInfo(null);
    setResult(null);
    setProgress(0);
    setImportMode('update-only');
    setToDeactivateList([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const insertCount = previewRecords.filter(r => r.action === 'insert').length;
  const updateCount = previewRecords.filter(r => r.action === 'update').length;
  const reactivateCount = previewRecords.filter(r => r.action === 'reactivate').length;
  const updateWithChangesCount = previewRecords.filter(r => (r.action === 'update' || r.action === 'reactivate') && r.changes && r.changes.length > 0).length;
  const deactivateCount = previewRecords.filter(r => r.action === 'deactivate').length;
  const skipCount = previewRecords.filter(r => r.action === 'skip').length;

  const exportCurrentEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('external_employees')
        .select('cpf, full_name, email, phone, position, department, cod_vendedor, companies:company_id(name)')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      if (!data || data.length === 0) { toast.warning('Não há funcionários ativos para exportar'); return; }
      const rows = data.map((f: any) => [
        f.cpf || '', f.full_name || '', f.email || '', f.phone || '',
        f.position || '', f.department || '', f.companies?.name || '', 'Ativo', f.cod_vendedor || '',
      ].join(';'));
      const csvContent = [CSV_HEADERS.join(';'), ...rows].join('\n');
      downloadCsv(csvContent, `funcionarios_${new Date().toISOString().split('T')[0]}.csv`);
      toast.success(`${data.length} funcionários exportados!`);
    } catch (error: any) {
      toast.error('Erro ao exportar funcionários');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Funcionários via CSV</DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo CSV para atualizar os dados dos funcionários.
            O CPF será usado como identificador único.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template Section */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileSpreadsheet className="h-4 w-4" />
              Baixar Modelo CSV
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <FileDown className="h-4 w-4 mr-2" />
                Modelo Vazio
              </Button>
              <Button variant="outline" size="sm" onClick={exportCurrentEmployees}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Atuais
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Formato: CPF;NOME;EMAIL;TELEFONE;CARGO;DEPARTAMENTO;EMPRESA;ATIVO;COD_VENDEDOR
            </p>
          </div>

          <Separator />

          {/* Import Mode */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <RefreshCw className="h-4 w-4" />
              Modo de Importação
            </div>
            <RadioGroup value={importMode} onValueChange={(v) => handleImportModeChange(v as ImportMode)} className="space-y-3">
              <div className="flex items-start gap-3 border rounded-lg p-3">
                <RadioGroupItem value="update-only" id="mode-update" className="mt-1" />
                <div>
                  <Label htmlFor="mode-update" className="font-medium cursor-pointer">Apenas Atualizar/Inserir (Recomendado)</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Processa apenas os registros do CSV. Funcionários que não estão na planilha permanecem inalterados.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 border border-destructive/30 rounded-lg p-3">
                <RadioGroupItem value="full-sync" id="mode-sync" className="mt-1" />
                <div>
                  <Label htmlFor="mode-sync" className="font-medium cursor-pointer text-destructive">Sincronização Total (Cuidado!)</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Funcionários que não estão na planilha serão INATIVADOS.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* File Input */}
          <div className="space-y-2">
            <input type="file" accept=".csv,.txt" ref={fileInputRef} onChange={handleFileSelect} className="hidden" id="csv-import-input" disabled={isProcessing} />
            <label htmlFor="csv-import-input" className="flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Clique para selecionar um arquivo CSV</span>
            </label>
          </div>

          {/* Analyzing */}
          {isAnalyzing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Analisando arquivo...
            </div>
          )}

          {/* Full-sync warning */}
          {importMode === 'full-sync' && toDeactivateList.length > 0 && !result && !isAnalyzing && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>ATENÇÃO: {toDeactivateList.length} funcionários serão INATIVADOS!</AlertTitle>
              <AlertDescription>
                <p className="text-sm mb-2">
                  Estes funcionários não constam na planilha e serão desativados:
                </p>
                <ScrollArea className="h-[150px]">
                  <div className="space-y-1">
                    {toDeactivateList.map(emp => (
                      <div key={emp.id} className="flex justify-between text-xs">
                        <span>{emp.nome}</span>
                        <span className="text-muted-foreground">{emp.cpf}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {previewRecords.length > 0 && !result && !isAnalyzing && (
            <div className="space-y-3">
              {/* Summary badges */}
              <div className="flex flex-wrap gap-2">
                {consolidationInfo && consolidationInfo.duplicatesConsolidated > 0 && (
                  <Badge variant="outline">{consolidationInfo.duplicatesConsolidated} CPFs duplicados consolidados</Badge>
                )}
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <Plus className="h-3 w-3 mr-1" />{insertCount} novos
                </Badge>
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  <RefreshCw className="h-3 w-3 mr-1" />{updateCount} existentes ({updateWithChangesCount} com alterações)
                </Badge>
                {reactivateCount > 0 && (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    <RotateCcw className="h-3 w-3 mr-1" />{reactivateCount} a reativar
                  </Badge>
                )}
                {deactivateCount > 0 && (
                  <Badge variant="destructive">
                    <UserMinus className="h-3 w-3 mr-1" />{deactivateCount} a inativar (CSV)
                  </Badge>
                )}
                {importMode === 'full-sync' && toDeactivateList.length > 0 && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />{toDeactivateList.length} ausentes (serão inativados)
                  </Badge>
                )}
                {skipCount > 0 && (
                  <Badge variant="secondary">{skipCount} ignorados</Badge>
                )}
              </div>

              {/* Tabs */}
              <Tabs defaultValue="insert" className="w-full">
                <TabsList className="w-full flex">
                  <TabsTrigger value="insert" className="flex-1">
                    <Plus className="h-3 w-3 mr-1" />Novos ({insertCount})
                  </TabsTrigger>
                  <TabsTrigger value="update" className="flex-1">
                    <RefreshCw className="h-3 w-3 mr-1" />Atualizar ({updateCount + reactivateCount})
                  </TabsTrigger>
                  <TabsTrigger value="other" className="flex-1">
                    Outros ({deactivateCount + skipCount})
                  </TabsTrigger>
                  {importMode === 'full-sync' && (
                    <TabsTrigger value="missing" className="flex-1">
                      <UserMinus className="h-3 w-3 mr-1" />Ausentes ({toDeactivateList.length})
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="insert">
                  <ScrollArea className="h-[300px]">
                    {insertCount === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum novo funcionário para inserir</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left p-2">CPF</th>
                            <th className="text-left p-2">Nome</th>
                            <th className="text-left p-2">Cargo</th>
                            <th className="text-left p-2">Empresa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewRecords.filter(r => r.action === 'insert').map((record, idx) => (
                            <tr key={idx} className="border-b">
                              <td className="p-2 font-mono text-xs">{record.cpf}</td>
                              <td className="p-2">{record.row.nome || '-'}</td>
                              <td className="p-2">{record.row.cargo || '-'}</td>
                              <td className="p-2">{record.row.empresa || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="update">
                  <ScrollArea className="h-[300px]">
                    {updateCount + reactivateCount === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum funcionário existente para atualizar</p>
                    ) : (
                      <div className="space-y-3">
                        {previewRecords.filter(r => r.action === 'update' || r.action === 'reactivate').map((record, idx) => (
                          <div key={idx} className="border rounded-lg p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{record.nome}</span>
                                {record.action === 'reactivate' && (
                                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                    <RotateCcw className="h-3 w-3 mr-1" />Será reativado
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground font-mono">{record.cpf}</span>
                            </div>
                            {record.changes && record.changes.length > 0 ? (
                              <div className="space-y-1">
                                {record.changes.map((change, cIdx) => (
                                  <div key={cIdx} className="flex items-center gap-2 text-xs">
                                    <span className="font-medium text-muted-foreground w-24 shrink-0">
                                      {fieldLabels[change.field] || change.field}:
                                    </span>
                                    <span className="text-destructive line-through">{change.oldValue || '(vazio)'}</span>
                                    <ArrowRight className="h-3 w-3 shrink-0" />
                                    <span className="text-green-600 font-medium">{change.newValue}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {record.action === 'reactivate' ? 'Será reativado (sem outras alterações)' : 'Sem alterações detectadas'}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="other">
                  <ScrollArea className="h-[300px]">
                    {deactivateCount + skipCount === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro para inativar ou ignorar</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left p-2">CPF</th>
                            <th className="text-left p-2">Nome</th>
                            <th className="text-left p-2">Ação</th>
                            <th className="text-left p-2">Motivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewRecords.filter(r => r.action === 'deactivate' || r.action === 'skip').map((record, idx) => (
                            <tr key={idx} className="border-b">
                              <td className="p-2 font-mono text-xs">{record.cpf}</td>
                              <td className="p-2">{record.nome}</td>
                              <td className="p-2">
                                {record.action === 'deactivate' ? (
                                  <Badge variant="destructive">Inativar</Badge>
                                ) : (
                                  <Badge variant="secondary">Ignorar</Badge>
                                )}
                              </td>
                              <td className="p-2 text-xs text-muted-foreground">
                                {record.action === 'deactivate' ? 'Marcado como inativo no CSV' : 'CPF inválido ou registro não existente'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </ScrollArea>
                </TabsContent>

                {importMode === 'full-sync' && (
                  <TabsContent value="missing">
                    <ScrollArea className="h-[300px]">
                      {toDeactivateList.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">Todos os funcionários ativos estão na planilha</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-muted-foreground">
                              <th className="text-left p-2">CPF</th>
                              <th className="text-left p-2">Nome</th>
                              <th className="text-left p-2">Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {toDeactivateList.map((emp, idx) => (
                              <tr key={idx} className="border-b">
                                <td className="p-2 font-mono text-xs">{emp.cpf}</td>
                                <td className="p-2">{emp.nome}</td>
                                <td className="p-2"><Badge variant="destructive">Será inativado</Badge></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </ScrollArea>
                  </TabsContent>
                )}
              </Tabs>
            </div>
          )}

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">{Math.round(progress)}% concluído</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {result.created > 0 && (
                  <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">{result.created} criados</span>
                  </div>
                )}
                {result.updated > 0 && (
                  <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                    <RefreshCw className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">{result.updated} atualizados</span>
                  </div>
                )}
                {result.reactivated > 0 && (
                  <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950 p-3 rounded-lg">
                    <RotateCcw className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium">{result.reactivated} reativados</span>
                  </div>
                )}
                {result.deactivated > 0 && (
                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                    <UserMinus className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium">{result.deactivated} inativados</span>
                  </div>
                )}
                {result.skipped > 0 && (
                  <div className="flex items-center gap-2 bg-muted p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{result.skipped} ignorados</span>
                  </div>
                )}
              </div>
              {result.errors.length > 0 && (
                <ScrollArea className="h-[150px] border rounded-lg p-3">
                  <div className="space-y-1">
                    {result.errors.map((err, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-destructive">
                        <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isProcessing}>Cancelar</Button>
              <Button
                onClick={processImport}
                disabled={isProcessing || previewRecords.length === 0 || isAnalyzing}
              >
                {isProcessing ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Processando...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" />Importar {previewRecords.filter(r => r.action !== 'skip').length} registros</>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
