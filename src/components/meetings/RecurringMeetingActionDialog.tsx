import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface RecurringMeetingActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scope: "single" | "future") => void;
  actionType: "edit" | "cancel";
  isRecurring: boolean;
}

export function RecurringMeetingActionDialog({
  open,
  onOpenChange,
  onConfirm,
  actionType,
  isRecurring,
}: RecurringMeetingActionDialogProps) {
  const [scope, setScope] = useState<"single" | "future">("single");

  const handleConfirm = () => {
    onConfirm(scope);
    onOpenChange(false);
  };

  const actionText = actionType === "edit" ? "editar" : "cancelar";
  const actionTextCapitalized = actionType === "edit" ? "Editar" : "Cancelar";

  if (!isRecurring) {
    // For non-recurring meetings, confirm directly
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actionTextCapitalized} Reunião</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja {actionText} esta reunião?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => onConfirm("single")}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{actionTextCapitalized} Reunião Recorrente</AlertDialogTitle>
          <AlertDialogDescription>
            Esta é uma reunião recorrente. Escolha o que deseja {actionText}:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup value={scope} onValueChange={(value: any) => setScope(value)}>
          <div className="flex items-center space-x-2 mb-3">
            <RadioGroupItem value="single" id="single" />
            <Label htmlFor="single" className="cursor-pointer">
              Apenas esta reunião
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="future" id="future" />
            <Label htmlFor="future" className="cursor-pointer">
              Esta e todas as ocorrências futuras
            </Label>
          </div>
        </RadioGroup>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            {actionTextCapitalized}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
