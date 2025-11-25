import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileText, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TranscriptionViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
}

export function TranscriptionViewer({ open, onOpenChange, meetingId }: TranscriptionViewerProps) {
  const { toast } = useToast();
  const [transcription, setTranscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTranscription();
    }
  }, [open, meetingId]);

  const fetchTranscription = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_transcriptions')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setTranscription(data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar transcrição",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAta = async () => {
    setGenerating(true);

    try {
      const { error } = await supabase.functions.invoke('generate-ata', {
        body: { meetingId }
      });

      if (error) throw error;

      toast({
        title: "ATA gerada com sucesso",
        description: "A ATA foi gerada pela IA e está disponível para revisão.",
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao gerar ATA",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: any }> = {
      pending: { label: 'Pendente', variant: 'secondary' },
      processing: { label: 'Processando', variant: 'default' },
      completed: { label: 'Concluída', variant: 'default' },
      failed: { label: 'Falhou', variant: 'destructive' },
    };

    const config = statusMap[status] || { label: status, variant: 'secondary' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transcrição da Reunião
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !transcription ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              Nenhuma transcrição encontrada para esta reunião.
            </p>
            <p className="text-sm text-muted-foreground">
              Faça o upload de uma gravação para gerar a transcrição automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                {getStatusBadge(transcription.status)}
              </div>
              {transcription.processed_at && (
                <span className="text-xs text-muted-foreground">
                  Processado em {new Date(transcription.processed_at).toLocaleString('pt-BR')}
                </span>
              )}
            </div>

            {transcription.status === 'processing' && (
              <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Processando transcrição... Isso pode levar alguns minutos.</span>
              </div>
            )}

            {transcription.status === 'completed' && transcription.content && (
              <>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{transcription.content}</p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleGenerateAta} disabled={generating}>
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando ATA...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Gerar ATA com IA
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {transcription.status === 'failed' && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">
                  Falha ao processar a transcrição. Por favor, tente fazer o upload novamente.
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
