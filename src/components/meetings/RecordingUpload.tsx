import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/external-client';
import { Upload, Loader2 } from 'lucide-react';

interface RecordingUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  onSuccess: () => void;
}

export function RecordingUpload({ open, onOpenChange, meetingId, onSuccess }: RecordingUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validar tipo de arquivo
      const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'video/mp4', 'video/webm'];
      if (!validTypes.includes(selectedFile.type)) {
        toast({
          title: "Formato inválido",
          description: "Por favor, selecione um arquivo de áudio ou vídeo válido (MP3, WAV, M4A, MP4, WEBM).",
          variant: "destructive",
        });
        return;
      }

      // Validar tamanho (máximo 100MB)
      const maxSize = 100 * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 100MB.",
          variant: "destructive",
        });
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo para fazer upload.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Criar entrada de transcrição pendente
      const { data: transcriptionData, error: transcriptionError } = await supabase
        .from('meeting_transcriptions')
        .insert({
          meeting_id: meetingId,
          status: 'pending',
        })
        .select()
        .single();

      if (transcriptionError) throw transcriptionError;

      // Converter arquivo para base64
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          const audioBase64 = base64.split(',')[1]; // Remove data URL prefix

          // Chamar edge function para transcrição
          const { error: functionError } = await supabase.functions.invoke('transcribe-meeting', {
            body: {
              meetingId,
              audioBase64,
            }
          });

          if (functionError) throw functionError;

          toast({
            title: "Upload realizado com sucesso",
            description: "A transcrição está sendo processada. Isso pode levar alguns minutos.",
          });

          onSuccess();
          onOpenChange(false);
          setFile(null);
        } catch (error: any) {
          console.error('Erro ao processar transcrição:', error);
          toast({
            title: "Erro ao processar",
            description: error.message,
            variant: "destructive",
          });
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        toast({
          title: "Erro ao ler arquivo",
          description: "Não foi possível ler o arquivo selecionado.",
          variant: "destructive",
        });
        setUploading(false);
      };

      reader.readAsDataURL(file);

    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload de Gravação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Arquivo de Áudio/Vídeo
            </label>
            <Input
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Formatos aceitos: MP3, WAV, M4A, MP4, WEBM (máximo 100MB)
            </p>
          </div>

          {file && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setFile(null);
              }}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !file}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Fazer Upload
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
