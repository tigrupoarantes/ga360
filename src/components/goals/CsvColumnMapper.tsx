import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CsvColumnMapperProps {
  csvColumns: string[];
  columnMapping: { [key: string]: string | null };
  onMappingChange: (fieldName: string, csvColumn: string | null) => void;
  requiredFields: string[];
  optionalFields: string[];
}

const FIELD_LABELS: { [key: string]: string } = {
  name: "Nome da Meta",
  target_value: "Valor da Meta",
  current_value: "Valor Atual",
  start_date: "Data Início",
  end_date: "Data Fim",
  goal_type: "Tipo de Meta",
  area: "Área/Setor",
  notes: "Observações",
};

export function CsvColumnMapper({
  csvColumns,
  columnMapping,
  onMappingChange,
  requiredFields,
  optionalFields,
}: CsvColumnMapperProps) {
  const allFields = [...requiredFields, ...optionalFields];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {allFields.map(field => {
          const isRequired = requiredFields.includes(field);
          const isMapped = !!columnMapping[field];

          return (
            <div key={field} className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{FIELD_LABELS[field] || field}</Label>
                {isRequired ? (
                  <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">Opcional</Badge>
                )}
              </div>
              <Select
                value={columnMapping[field] || "none"}
                onValueChange={(value) => onMappingChange(field, value === "none" ? null : value)}
              >
                <SelectTrigger className={!isMapped && isRequired ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione uma coluna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Não mapear --</SelectItem>
                  {csvColumns.map(col => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      <div className="text-sm text-muted-foreground">
        <p><strong>Dica:</strong> Para datas, use o formato AAAA-MM-DD (ex: 2025-01-15)</p>
        <p>Para valores numéricos, use ponto como separador decimal (ex: 1500.50)</p>
      </div>
    </div>
  );
}
