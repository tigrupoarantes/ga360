import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UnitSelector } from "./steps/UnitSelector";
import { BaseUploader } from "./steps/BaseUploader";
import { SampleGenerator } from "./steps/SampleGenerator";
import { CountingChecklist } from "./steps/CountingChecklist";
import { AuditFinalization } from "./steps/AuditFinalization";
import { useStockAudit } from "@/hooks/useStockAudit";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type WizardStep = "unit" | "upload" | "sample" | "counting" | "finalize";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "unit", label: "Unidade" },
  { key: "upload", label: "Base" },
  { key: "sample", label: "Amostra" },
  { key: "counting", label: "Contagem" },
  { key: "finalize", label: "Finalizar" },
];

interface StockAuditWizardProps {
  auditId?: string;
  initialStep?: WizardStep;
}

export function StockAuditWizard({ auditId: initialAuditId, initialStep = "unit" }: StockAuditWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [auditId, setAuditId] = useState<string | undefined>(initialAuditId);
  const [selectedUnit, setSelectedUnit] = useState<{ id: string; name: string } | null>(null);
  const [totalItems, setTotalItems] = useState(0);

  const { createAudit, audit } = useStockAudit(auditId);

  // Determine initial step based on audit status
  useEffect(() => {
    if (audit) {
      if (audit.status === "completed") {
        setStep("finalize");
      } else if (audit.status === "in_progress") {
        setStep("counting");
      } else if (audit.total_items_loaded > 0 && audit.sample_size) {
        setStep("counting");
      } else if (audit.total_items_loaded > 0) {
        setStep("sample");
      }
      setTotalItems(audit.total_items_loaded);
    }
  }, [audit]);

  const handleUnitSelect = async (unitId: string, unitName: string) => {
    setSelectedUnit({ id: unitId, name: unitName });
    
    // Create new audit
    const newAudit = await createAudit.mutateAsync(unitId);
    if (newAudit) {
      setAuditId(newAudit.id);
      // Update URL without full navigation
      window.history.replaceState(null, "", `/governanca-ec/auditoria/estoque/${newAudit.id}`);
      setStep("upload");
    }
  };

  const handleUploadComplete = (itemCount: number) => {
    setTotalItems(itemCount);
    setStep("sample");
  };

  const handleSampleComplete = () => {
    setStep("counting");
  };

  const handleCountingComplete = () => {
    setStep("finalize");
  };

  const handleFinalizeComplete = () => {
    navigate("/governanca-ec/auditoria/estoque");
  };

  const currentStepIndex = STEPS.findIndex(s => s.key === step);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="space-y-4">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between">
          {STEPS.map((s, idx) => (
            <div
              key={s.key}
              className={cn(
                "flex flex-col items-center",
                idx <= currentStepIndex ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mb-1",
                  idx < currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : idx === currentStepIndex
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {idx + 1}
              </div>
              <span className="text-xs hidden sm:block">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="pt-6">
        {step === "unit" && (
          <UnitSelector onSelect={handleUnitSelect} />
        )}

        {step === "upload" && auditId && (
          <BaseUploader
            auditId={auditId}
            onComplete={handleUploadComplete}
            onBack={() => {
              setAuditId(undefined);
              setStep("unit");
              navigate("/governanca-ec/auditoria/estoque");
            }}
          />
        )}

        {step === "sample" && auditId && (
          <SampleGenerator
            auditId={auditId}
            totalItems={totalItems}
            onComplete={handleSampleComplete}
            onBack={() => setStep("upload")}
          />
        )}

        {step === "counting" && auditId && (
          <CountingChecklist
            auditId={auditId}
            onComplete={handleCountingComplete}
            onBack={() => setStep("sample")}
          />
        )}

        {step === "finalize" && auditId && (
          <AuditFinalization
            auditId={auditId}
            onComplete={handleFinalizeComplete}
            onBack={() => setStep("counting")}
          />
        )}
      </div>
    </div>
  );
}
