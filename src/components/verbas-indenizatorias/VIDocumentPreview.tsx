import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Download, ExternalLink, FileText } from 'lucide-react';
import type { VIDocument } from '@/hooks/useVerbasIndenizatorias';

interface Props {
  document: VIDocument | null;
  open: boolean;
  onClose: () => void;
}

export function VIDocumentPreview({ document, open, onClose }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !document) {
      setSignedUrl(null);
      setError(null);
      return;
    }

    const filePath = document.signed_file_path || document.generated_file_path;
    if (!filePath) {
      setError('Nenhum arquivo disponível para este documento.');
      return;
    }

    setLoading(true);
    setError(null);

    supabase.storage
      .from('verbas-indenizatorias')
      .createSignedUrl(filePath, 300) // 5 minutos
      .then(({ data, error: storageError }) => {
        if (storageError || !data?.signedUrl) {
          setError('Não foi possível gerar o link de visualização.');
        } else {
          setSignedUrl(data.signedUrl);
        }
      })
      .finally(() => setLoading(false));
  }, [open, document]);

  const fileName = document
    ? `verba_${document.employee_name.replace(/\s+/g, '_')}_${document.competencia}.pdf`
    : 'documento.pdf';

  const isSignedVersion = !!document?.signed_file_path;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {isSignedVersion ? 'Documento Assinado' : 'Visualizar Documento'}
            {document && (
              <span className="text-sm font-normal text-muted-foreground ml-1">
                — {document.employee_name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-md border overflow-hidden" style={{ minHeight: '500px' }}>
          {loading && (
            <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Carregando documento...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-8 text-center">
              <FileText className="h-10 w-10 opacity-40" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && signedUrl && (
            <iframe
              src={signedUrl}
              title="Visualização do documento"
              className="w-full h-full border-0"
              style={{ minHeight: '500px' }}
            />
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {signedUrl && (
            <>
              <Button variant="outline" asChild>
                <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir em nova aba
                </a>
              </Button>
              <Button asChild>
                <a href={signedUrl} download={fileName}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar PDF
                </a>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
