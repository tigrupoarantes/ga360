import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Upload, 
  Link2, 
  FileText, 
  Trash2, 
  ExternalLink,
  Loader2,
  Plus
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ECEvidenceUploadProps {
  recordId?: string;
  cardId: string;
}

export function ECEvidenceUpload({ recordId, cardId }: ECEvidenceUploadProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'link'>('file');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDescription, setFileDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const { data: evidences, isLoading } = useQuery({
    queryKey: ['ec-record-evidences', recordId],
    queryFn: async () => {
      if (!recordId) return [];
      
      const { data, error } = await supabase
        .from('ec_record_evidences')
        .select(`
          *,
          created_by_profile:profiles!ec_record_evidences_created_by_fkey(first_name, last_name)
        `)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!recordId,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!recordId) {
        throw new Error('Salve o registro antes de adicionar evidências');
      }

      setIsUploading(true);

      if (uploadType === 'link') {
        const { error } = await supabase
          .from('ec_record_evidences')
          .insert({
            record_id: recordId,
            type: 'link',
            url: linkUrl,
            description: linkDescription,
            created_by: user?.id,
          });
        
        if (error) throw error;
      } else if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${user?.id}/${recordId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('ec-evidences')
          .upload(fileName, selectedFile);
        
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from('ec_record_evidences')
          .insert({
            record_id: recordId,
            type: 'file',
            file_path: fileName,
            description: fileDescription || selectedFile.name,
            created_by: user?.id,
          });
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      toast.success('Evidência adicionada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['ec-record-evidences', recordId] });
      setIsDialogOpen(false);
      setLinkUrl('');
      setLinkDescription('');
      setSelectedFile(null);
      setFileDescription('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao adicionar evidência');
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (evidence: any) => {
      if (evidence.type === 'file' && evidence.file_path) {
        await supabase.storage
          .from('ec-evidences')
          .remove([evidence.file_path]);
      }

      const { error } = await supabase
        .from('ec_record_evidences')
        .delete()
        .eq('id', evidence.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Evidência removida');
      queryClient.invalidateQueries({ queryKey: ['ec-record-evidences', recordId] });
    },
    onError: () => {
      toast.error('Erro ao remover evidência');
    },
  });

  const handleViewFile = async (filePath: string) => {
    const { data } = await supabase.storage
      .from('ec-evidences')
      .createSignedUrl(filePath, 3600);
    
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  if (!recordId) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground text-sm">
          Salve o registro primeiro para adicionar evidências.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {evidences?.length || 0} evidência(s) anexada(s)
        </span>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Evidência</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={uploadType === 'file' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUploadType('file')}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Arquivo
                </Button>
                <Button
                  variant={uploadType === 'link' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUploadType('link')}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Link
                </Button>
              </div>

              {uploadType === 'file' ? (
                <div className="space-y-3">
                  <div>
                    <Label>Arquivo</Label>
                    <Input
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                    />
                  </div>
                  <div>
                    <Label>Descrição (opcional)</Label>
                    <Input
                      value={fileDescription}
                      onChange={(e) => setFileDescription(e.target.value)}
                      placeholder="Descreva o arquivo..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label>URL</Label>
                    <Input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Input
                      value={linkDescription}
                      onChange={(e) => setLinkDescription(e.target.value)}
                      placeholder="Descreva o link..."
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={isUploading || (uploadType === 'file' ? !selectedFile : !linkUrl)}
                className="w-full"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Adicionar Evidência
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-12 bg-muted rounded" />
          <div className="h-12 bg-muted rounded" />
        </div>
      ) : evidences && evidences.length > 0 ? (
        <div className="space-y-2">
          {evidences.map((evidence: any) => (
            <div 
              key={evidence.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {evidence.type === 'file' ? (
                  <FileText className="h-5 w-5 text-primary" />
                ) : (
                  <Link2 className="h-5 w-5 text-primary" />
                )}
                <div>
                  <p className="font-medium text-sm">{evidence.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {evidence.created_by_profile?.first_name} {evidence.created_by_profile?.last_name} • 
                    {format(new Date(evidence.created_at), " dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {evidence.type === 'file' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewFile(evidence.file_path)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(evidence.url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(evidence)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma evidência anexada
        </p>
      )}
    </div>
  );
}
