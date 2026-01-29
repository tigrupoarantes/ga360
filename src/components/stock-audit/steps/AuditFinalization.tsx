import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  ClipboardCheck,
  User,
  FileCheck,
  Mail,
  Loader2
} from "lucide-react";
import { useStockAudit } from "@/hooks/useStockAudit";

interface AuditFinalizationProps {
  auditId: string;
  onComplete: () => void;
  onBack: () => void;
}

const formatCPF = (value: string): string => {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
};

const validateCPF = (cpf: string): boolean => {
  const numbers = cpf.replace(/\D/g, "");
  return numbers.length === 11;
};

export function AuditFinalization({ auditId, onComplete, onBack }: AuditFinalizationProps) {
  const { audit, stats, completeAudit } = useStockAudit(auditId);
  
  const [witnessName, setWitnessName] = useState("");
  const [witnessCpf, setWitnessCpf] = useState("");
  const [movementDuringAudit, setMovementDuringAudit] = useState(false);
  const [movementNotes, setMovementNotes] = useState("");
  const [termAccepted, setTermAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWitnessCpf(formatCPF(e.target.value));
  };

  const isValid = witnessName.trim() !== "" && 
                  validateCPF(witnessCpf) && 
                  termAccepted &&
                  (!movementDuringAudit || movementNotes.trim() !== "");

  const handleComplete = async () => {
    if (!isValid) return;
    
    setSubmitting(true);
    try {
      await completeAudit.mutateAsync({
        name: witnessName,
        cpf: witnessCpf.replace(/\D/g, ""),
        movementDuringAudit,
        movementNotes: movementDuringAudit ? movementNotes : undefined,
      });
      onComplete();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Finalizar Auditoria</h2>
        <p className="text-muted-foreground mt-1">
          Revise o resumo e colete os dados da testemunha
        </p>
      </div>

      {/* Summary card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Resumo da Auditoria
          </CardTitle>
          <CardDescription>
            Unidade: {audit?.unit?.name || "..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total contado</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/30">
              <p className="text-3xl font-bold text-green-600">{stats.ok}</p>
              <p className="text-sm text-muted-foreground">OK</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
              <p className="text-3xl font-bold text-yellow-600">{stats.divergent}</p>
              <p className="text-sm text-muted-foreground">Divergentes</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <p className="text-3xl font-bold text-blue-600">{stats.recounted}</p>
              <p className="text-sm text-muted-foreground">Recontados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Movement during audit */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base">Houve movimentação durante a auditoria?</Label>
              <p className="text-sm text-muted-foreground">
                Entradas ou saídas de estoque enquanto a contagem era realizada
              </p>
            </div>
            <Switch
              checked={movementDuringAudit}
              onCheckedChange={setMovementDuringAudit}
            />
          </div>
          
          {movementDuringAudit && (
            <div className="mt-4 space-y-2">
              <Label>Descreva a movimentação</Label>
              <Textarea
                value={movementNotes}
                onChange={(e) => setMovementNotes(e.target.value)}
                placeholder="Ex: Recebimento de mercadoria às 14h durante a contagem..."
                rows={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Witness form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Testemunha da Auditoria
          </CardTitle>
          <CardDescription>
            Dados do responsável que acompanhou a auditoria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome completo *</Label>
              <Input
                value={witnessName}
                onChange={(e) => setWitnessName(e.target.value)}
                placeholder="Nome da testemunha"
              />
            </div>
            <div className="space-y-2">
              <Label>CPF *</Label>
              <Input
                value={witnessCpf}
                onChange={handleCpfChange}
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>
          </div>

          <div className="flex items-start space-x-3 pt-4">
            <Checkbox
              id="term"
              checked={termAccepted}
              onCheckedChange={(checked) => setTermAccepted(checked === true)}
            />
            <label
              htmlFor="term"
              className="text-sm leading-relaxed cursor-pointer"
            >
              Declaro que acompanhei a auditoria de estoque nesta unidade e confirmo que as contagens foram realizadas conforme os procedimentos estabelecidos.
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Validation alert */}
      {stats.pending > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Ainda existem {stats.pending} item(s) pendente(s) de contagem. Complete todas as contagens antes de finalizar.
          </AlertDescription>
        </Alert>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        
        <Button 
          onClick={handleComplete}
          disabled={!isValid || stats.pending > 0 || submitting}
          size="lg"
          className="min-w-40"
        >
          {submitting ? "Concluindo..." : "Concluir Auditoria"}
          <FileCheck className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
