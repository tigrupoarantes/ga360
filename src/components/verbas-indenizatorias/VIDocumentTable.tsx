import { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { VIStatusBadge } from './VIStatusBadge';
import { VIDocumentDetail } from './VIDocumentDetail';
import { useVIResend } from '@/hooks/useVerbasIndenizatorias';
import type { VIDocument } from '@/hooks/useVerbasIndenizatorias';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Eye, Mail, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  documents: VIDocument[];
  total: number;
  page: number;
  pageSize: number;
  companyId: string;
  onPageChange: (page: number) => void;
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function VIDocumentTable({
  documents,
  total,
  page,
  pageSize,
  companyId,
  onPageChange,
}: Props) {
  const [selectedDoc, setSelectedDoc] = useState<VIDocument | null>(null);
  const resendMutation = useVIResend();

  const handleDownloadSigned = async (doc: VIDocument) => {
    const path = doc.signed_file_path || doc.generated_file_path;
    if (!path) return;
    const { data, error } = await supabase.storage
      .from("verbas-indenizatorias")
      .download(path);
    if (error || !data) {
      toast.error("Erro ao baixar documento");
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verba_${doc.employee_name.replace(/\s+/g, "_")}_${doc.competencia}_assinado.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Download iniciado");
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Competência</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Gerado em</TableHead>
              <TableHead className="w-28">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  Nenhum documento encontrado para os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => {
                const valorTotal = Number(doc.valor_verba) + Number(doc.valor_adiantamento);
                const canResend =
                  ['sent_to_sign', 'waiting_signature'].includes(doc.d4sign_status) &&
                  !!doc.employee_email;

                return (
                  <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell
                      className="font-medium"
                      onClick={() => setSelectedDoc(doc)}
                    >
                      {doc.employee_name}
                    </TableCell>
                    <TableCell
                      className="font-mono text-sm text-muted-foreground"
                      onClick={() => setSelectedDoc(doc)}
                    >
                      {doc.employee_cpf}
                    </TableCell>
                    <TableCell onClick={() => setSelectedDoc(doc)}>
                      {doc.competencia}
                    </TableCell>
                    <TableCell onClick={() => setSelectedDoc(doc)}>
                      <Badge variant={doc.event_type === 'ADIANT_INDENIZATORIA' ? 'secondary' : 'default'}>
                        {doc.event_type === 'ADIANT_INDENIZATORIA' ? 'Adiant.' : 'Verba'}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="text-right font-mono text-sm"
                      onClick={() => setSelectedDoc(doc)}
                    >
                      {formatBRL(valorTotal)}
                    </TableCell>
                    <TableCell onClick={() => setSelectedDoc(doc)}>
                      <VIStatusBadge status={doc.d4sign_status} />
                    </TableCell>
                    <TableCell
                      className="text-sm text-muted-foreground"
                      onClick={() => setSelectedDoc(doc)}
                    >
                      {format(new Date(doc.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Ver detalhes"
                          onClick={() => setSelectedDoc(doc)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {canResend && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Reenviar lembrete"
                            onClick={() => resendMutation.mutate({ documentId: doc.id, companyId })}
                            disabled={resendMutation.isPending}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {doc.signed_file_path && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Baixar assinado"
                            onClick={(e) => { e.stopPropagation(); handleDownloadSigned(doc); }}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-3">
          <span>
            {total} documento{total !== 1 ? 's' : ''} • Página {page} de {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="outline"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <VIDocumentDetail
        document={selectedDoc}
        companyId={companyId}
        open={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
      />
    </>
  );
}
