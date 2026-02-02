import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ECStatusBadge, ECStatus } from "./ECStatusBadge";
import { ECManualForm } from "./ECManualForm";
import { ECDatalakeViewer } from "./ECDatalakeViewer";
import { ECEvidenceUpload } from "./ECEvidenceUpload";
import { ECComments } from "./ECComments";
import { ECCardTasks } from "./ECCardTasks";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  FileText, 
  Database, 
  MessageSquare, 
  ClipboardList,
  Calendar,
  User,
  CheckCircle2,
  RefreshCw,
  ListTodo
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface ECCardDetailProps {
  card: any;
  initialTab?: string;
}

export function ECCardDetail({ card, initialTab = 'summary' }: ECCardDetailProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(initialTab);

  // Buscar registros do card
  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ['ec-card-records', card.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ec_card_records')
        .select('*')
        .eq('card_id', card.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Buscar bindings de datalake
  const { data: bindings } = useQuery({
    queryKey: ['ec-card-bindings', card.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dl_card_bindings')
        .select(`
          *,
          query:dl_queries(*)
        `)
        .eq('card_id', card.id)
        .eq('is_enabled', true);
      
      if (error) throw error;
      return data;
    },
  });

  const currentRecord = records?.[0];
  const hasDatalake = bindings && bindings.length > 0;

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!currentRecord) {
        // Criar um novo registro se não existir
        const competence = format(new Date(), 'yyyy-MM');
        const { data, error } = await supabase
          .from('ec_card_records')
          .insert({
            card_id: card.id,
            competence,
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: user?.id,
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from('ec_card_records')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
        })
        .eq('id', currentRecord.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Card marcado como concluído');
      queryClient.invalidateQueries({ queryKey: ['ec-card-records', card.id] });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status');
      console.error(error);
    },
  });

  if (recordsLoading) {
    return <Skeleton className="h-96" />;
  }

  const responsibleName = card.responsible
    ? `${card.responsible.first_name} ${card.responsible.last_name}`.trim()
    : 'Não atribuído';

  return (
    <div className="space-y-6">
      {/* Header com informações principais */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <ECStatusBadge status={(currentRecord?.status as ECStatus) || 'pending'} size="lg" />
            <div>
              <p className="text-sm text-muted-foreground">Competência</p>
              <p className="font-semibold">{currentRecord?.competence || format(new Date(), 'yyyy-MM')}</p>
            </div>
            {currentRecord?.due_date && (
              <div>
                <p className="text-sm text-muted-foreground">Vencimento</p>
                <p className="font-semibold flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(currentRecord.due_date), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Responsável:</span>
              <Avatar className="h-6 w-6">
                <AvatarImage src={card.responsible?.avatar_url} />
                <AvatarFallback>
                  {card.responsible?.first_name?.[0]}{card.responsible?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{responsibleName}</span>
            </div>

            {currentRecord?.status !== 'completed' && currentRecord?.status !== 'reviewed' && (
              <Button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Marcar Concluído
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Resumo</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">Tarefas</span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Manual</span>
          </TabsTrigger>
          <TabsTrigger value="datalake" className="flex items-center gap-2" disabled={!hasDatalake}>
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Datalake</span>
            {!hasDatalake && <span className="text-xs hidden sm:inline">(N/A)</span>}
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Comentários</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Métricas manuais */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Dados Manuais</h3>
              {currentRecord?.manual_payload_json && Object.keys(currentRecord.manual_payload_json).length > 0 ? (
                <pre className="text-sm bg-muted p-3 rounded overflow-auto max-h-48">
                  {JSON.stringify(currentRecord.manual_payload_json, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhum dado manual registrado</p>
              )}
            </Card>

            {/* Métricas do datalake */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Dados do Datalake</h3>
              {currentRecord?.datalake_snapshot_json && Object.keys(currentRecord.datalake_snapshot_json).length > 0 ? (
                <pre className="text-sm bg-muted p-3 rounded overflow-auto max-h-48">
                  {JSON.stringify(currentRecord.datalake_snapshot_json, null, 2)}
                </pre>
              ) : hasDatalake ? (
                <p className="text-muted-foreground text-sm">Nenhum dado do datalake disponível</p>
              ) : (
                <p className="text-muted-foreground text-sm">Card não possui vínculo com datalake</p>
              )}
            </Card>
          </div>

          {/* Evidências */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Evidências</h3>
            <ECEvidenceUpload recordId={currentRecord?.id} cardId={card.id} />
          </Card>

          {/* Histórico resumido */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Histórico de Atualizações</h3>
            {records && records.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-auto">
                {records.slice(0, 5).map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <ECStatusBadge status={record.status as ECStatus} size="sm" />
                      <span className="text-sm">{record.competence}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(record.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhuma atualização ainda</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <ECCardTasks cardId={card.id} recordId={currentRecord?.id} />
        </TabsContent>

        <TabsContent value="manual">
          <ECManualForm 
            card={card} 
            record={currentRecord} 
          />
        </TabsContent>

        <TabsContent value="datalake">
          <ECDatalakeViewer 
            cardId={card.id} 
            bindings={bindings || []} 
            record={currentRecord}
          />
        </TabsContent>

        <TabsContent value="comments">
          <ECComments recordId={currentRecord?.id} cardId={card.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
