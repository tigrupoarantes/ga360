import { useCallback, useState, useEffect } from 'react';
import { useScribe } from '@elevenlabs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mic, MicOff, Loader2, Radio, Save } from 'lucide-react';

interface RealtimeTranscriptionProps {
  meetingId: string;
  onTranscriptionUpdate?: (text: string) => void;
  onSave?: (fullTranscription: string) => void;
}

export function RealtimeTranscription({ 
  meetingId, 
  onTranscriptionUpdate,
  onSave 
}: RealtimeTranscriptionProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [fullTranscription, setFullTranscription] = useState('');

  const scribe = useScribe({
    onPartialTranscript: (data) => {
      console.log('Partial:', data.text);
    },
    onCommittedTranscript: (data) => {
      console.log('Committed:', data.text);
      setFullTranscription(prev => {
        const newText = prev ? `${prev} ${data.text}` : data.text;
        onTranscriptionUpdate?.(newText);
        return newText;
      });
    },
  });

  const handleStart = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get token from edge function
      const { data, error } = await supabase.functions.invoke('elevenlabs-scribe-token');

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.token) {
        throw new Error('No token received from server');
      }

      // Start the transcription session
      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      toast({
        title: 'Transcrição iniciada',
        description: 'A transcrição em tempo real está ativa.',
      });
    } catch (error: unknown) {
      console.error('Failed to start transcription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao iniciar transcrição',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  }, [scribe, toast]);

  const handleStop = useCallback(() => {
    scribe.disconnect();
    toast({
      title: 'Transcrição pausada',
      description: 'A transcrição em tempo real foi interrompida.',
    });
  }, [scribe, toast]);

  const handleSave = useCallback(async () => {
    if (!fullTranscription) {
      toast({
        title: 'Nada para salvar',
        description: 'Não há transcrição para salvar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Save transcription to database
      const { error } = await supabase
        .from('meeting_transcriptions')
        .upsert({
          meeting_id: meetingId,
          content: fullTranscription,
          status: 'completed',
        }, {
          onConflict: 'meeting_id',
        });

      if (error) throw error;

      toast({
        title: 'Transcrição salva',
        description: 'A transcrição foi salva com sucesso.',
      });

      onSave?.(fullTranscription);
    } catch (error: unknown) {
      console.error('Failed to save transcription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao salvar',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [fullTranscription, meetingId, toast, onSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scribe.isConnected) {
        scribe.disconnect();
      }
    };
  }, [scribe]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Transcrição em Tempo Real
          </CardTitle>
          <Badge variant={scribe.isConnected ? 'default' : 'secondary'}>
            {scribe.isConnected ? (
              <>
                <span className="animate-pulse mr-1">●</span>
                Ao vivo
              </>
            ) : (
              'Desconectado'
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <div className="flex gap-2">
          {!scribe.isConnected ? (
            <Button 
              onClick={handleStart} 
              disabled={isConnecting}
              className="flex-1"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  Iniciar Transcrição
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={handleStop} 
              variant="destructive"
              className="flex-1"
            >
              <MicOff className="mr-2 h-4 w-4" />
              Parar Transcrição
            </Button>
          )}
          <Button 
            onClick={handleSave} 
            variant="outline"
            disabled={!fullTranscription}
          >
            <Save className="mr-2 h-4 w-4" />
            Salvar
          </Button>
        </div>

        <ScrollArea className="flex-1 rounded-md border p-4 bg-muted/30">
          {scribe.partialTranscript && (
            <p className="text-muted-foreground italic mb-2">
              {scribe.partialTranscript}
            </p>
          )}
          
          {fullTranscription ? (
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">
              {fullTranscription}
            </p>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              {scribe.isConnected 
                ? 'Aguardando fala...' 
                : 'Clique em "Iniciar Transcrição" para começar'}
            </p>
          )}
        </ScrollArea>

        <div className="text-xs text-muted-foreground">
          {scribe.committedTranscripts.length > 0 && (
            <span>{scribe.committedTranscripts.length} segmentos transcritos</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
