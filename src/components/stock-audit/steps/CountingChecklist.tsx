import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  ArrowRight, 
  Camera, 
  MessageSquare, 
  CheckCircle2,
  AlertTriangle,
  Package,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { useStockAudit, StockAuditItem } from "@/hooks/useStockAudit";
import { cn } from "@/lib/utils";

interface CountingChecklistProps {
  auditId: string;
  onComplete: () => void;
  onBack: () => void;
}

export function CountingChecklist({ auditId, onComplete, onBack }: CountingChecklistProps) {
  const { audit, sampleItems, stats, updateItem } = useStockAudit(auditId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [physicalQty, setPhysicalQty] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSystemQty, setShowSystemQty] = useState(false);

  const currentItem = sampleItems[currentIndex];
  const progress = stats.counted / stats.total * 100;
  const isBlindCount = audit?.blind_count_enabled ?? true;

  useEffect(() => {
    if (currentItem) {
      setPhysicalQty(currentItem.physical_qty?.toString() || "");
      setNotes(currentItem.item_notes || "");
      setShowSystemQty(!isBlindCount || currentItem.result !== "pending");
    }
  }, [currentItem, isBlindCount]);

  const calculateResult = (physical: number, system: number): StockAuditItem["result"] => {
    const diff = physical - system;
    if (diff === 0) return "ok";
    return "divergent";
  };

  const handleSave = async () => {
    if (!currentItem || physicalQty === "") return;
    
    setSaving(true);
    try {
      const physical = parseFloat(physicalQty);
      const diff = physical - currentItem.system_qty;
      const result = calculateResult(physical, currentItem.system_qty);

      await updateItem.mutateAsync({
        itemId: currentItem.id,
        updates: {
          physical_qty: physical,
          final_physical_qty: physical,
          final_diff_qty: diff,
          result,
          item_notes: notes || null,
          audited_at: new Date().toISOString(),
        },
      });

      setShowSystemQty(true);

      // Auto-advance after short delay
      setTimeout(() => {
        if (currentIndex < sampleItems.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
      }, 1000);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && physicalQty !== "") {
      handleSave();
    }
  };

  const getDiffColor = (diff: number) => {
    if (diff === 0) return "text-green-600";
    return diff > 0 ? "text-blue-600" : "text-red-600";
  };

  const getDiffIcon = (result: string) => {
    if (result === "ok") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  };

  if (!currentItem) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Nenhum item na amostra</p>
      </div>
    );
  }

  const allCounted = stats.pending === 0;

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Contagem</h2>
          <Badge variant="secondary" className="text-base px-3 py-1">
            {stats.counted}/{stats.total}
          </Badge>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Item navigation pills */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {sampleItems.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => setCurrentIndex(idx)}
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-lg text-sm font-medium transition-all",
              idx === currentIndex 
                ? "bg-primary text-primary-foreground shadow-md scale-110" 
                : item.result === "ok"
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : item.result !== "pending"
                    ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      {/* Main counting card */}
      <Card className="border-2">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl font-mono">{currentItem.sku_code}</CardTitle>
              {currentItem.sku_description && (
                <p className="text-muted-foreground mt-1">{currentItem.sku_description}</p>
              )}
            </div>
            {currentItem.result !== "pending" && getDiffIcon(currentItem.result)}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {currentItem.uom && (
              <Badge variant="outline">UM: {currentItem.uom}</Badge>
            )}
            {currentItem.location && (
              <Badge variant="outline">Local: {currentItem.location}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Physical quantity input */}
          <div className="space-y-2">
            <Label className="text-lg">Quantidade Física</Label>
            <Input
              type="number"
              value={physicalQty}
              onChange={(e) => setPhysicalQty(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite a quantidade contada"
              className="text-3xl h-16 text-center font-mono"
              autoFocus
            />
          </div>

          {/* System quantity (shown after save or if blind count is off) */}
          {showSystemQty && (
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Quantidade Sistema:</span>
                <span className="font-mono text-lg">{currentItem.system_qty}</span>
              </div>
              {currentItem.physical_qty !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Diferença:</span>
                  <span className={cn(
                    "font-mono text-lg font-bold",
                    getDiffColor(currentItem.final_diff_qty || 0)
                  )}>
                    {(currentItem.final_diff_qty || 0) > 0 ? "+" : ""}
                    {currentItem.final_diff_qty || 0}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notes section */}
          {showNotes && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Observação</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowNotes(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione uma observação..."
                rows={2}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowNotes(!showNotes)}
              className="flex-1"
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              Obs
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              disabled
            >
              <Camera className="h-5 w-5 mr-2" />
              Foto
            </Button>
            <Button
              size="lg"
              onClick={handleSave}
              disabled={physicalQty === "" || saving}
              className="flex-[2]"
            >
              {saving ? "Salvando..." : "Salvar"}
              <CheckCircle2 className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Navigation footer */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => currentIndex > 0 ? setCurrentIndex(prev => prev - 1) : onBack()}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          {currentIndex > 0 ? "Anterior" : "Voltar"}
        </Button>

        <div className="text-sm text-muted-foreground">
          Item {currentIndex + 1} de {sampleItems.length}
        </div>

        {currentIndex < sampleItems.length - 1 ? (
          <Button
            variant="outline"
            onClick={() => setCurrentIndex(prev => prev + 1)}
          >
            Próximo
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={onComplete}
            disabled={!allCounted}
          >
            Finalizar
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <Card className="p-4">
          <p className="text-2xl font-bold text-green-600">{stats.ok}</p>
          <p className="text-xs text-muted-foreground">OK</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-yellow-600">{stats.divergent}</p>
          <p className="text-xs text-muted-foreground">Divergente</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-muted-foreground">{stats.pending}</p>
          <p className="text-xs text-muted-foreground">Pendente</p>
        </Card>
      </div>
    </div>
  );
}
