import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, FilePlus } from 'lucide-react';
import { STARTER_TEMPLATES } from './starter-templates';

interface Props {
  open: boolean;
  onSelect: (html: string) => void;
  onClose: () => void;
}

export function StarterTemplatePicker({ open, onSelect, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Escolha um modelo inicial</DialogTitle>
          <DialogDescription>
            Selecione um template pronto para personalizar ou comece do zero.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          {STARTER_TEMPLATES.map((tpl) => (
            <Card
              key={tpl.id}
              className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
              onClick={() => {
                onSelect(tpl.html);
                onClose();
              }}
            >
              <CardHeader className="p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-8 w-8 text-primary shrink-0 mt-0.5" />
                  <div>
                    <CardTitle className="text-sm">{tpl.name}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {tpl.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}

          {/* Blank template option */}
          <Card
            className="cursor-pointer hover:border-primary hover:shadow-md transition-all border-dashed"
            onClick={() => {
              onSelect('');
              onClose();
            }}
          >
            <CardHeader className="p-4">
              <div className="flex items-start gap-3">
                <FilePlus className="h-8 w-8 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <CardTitle className="text-sm">Em branco</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Comece do zero e crie seu proprio documento.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
