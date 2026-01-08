import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserCsvImporter } from "./UserCsvImporter";

interface UserImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function UserImportDialog({ open, onOpenChange, onComplete }: UserImportDialogProps) {
  const handleComplete = () => {
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Usuários em Massa</DialogTitle>
        </DialogHeader>
        <UserCsvImporter onComplete={handleComplete} />
      </DialogContent>
    </Dialog>
  );
}
