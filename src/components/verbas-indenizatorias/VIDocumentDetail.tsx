import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { VIStatusBadge } from './VIStatusBadge';
import { useVIResend, useVICancel } from '@/hooks/useVerbasIndenizatorias';
import type { VIDocument } from '@/hooks/useVerbasIndenizatorias';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Mail, XCircle, ExternalLink, Download } from 'lucide-react';

interface Props {
  document: VIDocument | null;
  companyId: string;
  open: boolean;
  onClose: () => void;
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export function VIDocumentDetail({ document: doc, companyId, open, onClose }: Props) {
  const resendMutation = useVIResend();
  const cancelMutation = useVICancel();

  if (!doc) return null;

  const valorTotal = Number(doc.valor_verba) + Number(doc.valor_adiantamento);
  const canResend = ['sent_to_sign', 'waiting_signature'].includes(doc.d4sign_status) && doc.employee_email;
  const canCancel = doc.d4sign_document_uuid && !['signed', 'cancelled'].includes(doc.d4sign_status);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes do Documento</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-3">
            <VIStatusBadge status={doc.d4sign_status} />
            {doc.d4sign_document_uuid && (
              <span className="text-xs text-muted-foreground font-mono">
                {doc.d4sign_document_uuid.slice(0, 8)}...
              </span>
            )}
          </div>

          {/* Funcionário */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Funcionário
            </p>
            <div className="space-y-2">
              <InfoRow label="Nome" value={doc.employee_name} />
              <InfoRow label="CPF" value={doc.employee_cpf} />
              <InfoRow label="E-mail" value={doc.employee_email} />
              <InfoRow label="Departamento" value={doc.employee_department} />
              <InfoRow label="Cargo" value={doc.employee_position} />
              <InfoRow label="Unidade" value={doc.employee_unit} />
            </div>
          </div>

          <Separator />

          {/* Financeiro */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Valores — {doc.competencia}
            </p>
            <div className="space-y-2">
              <InfoRow label="Verba Indenizatória" value={formatBRL(Number(doc.valor_verba))} />
              {Number(doc.valor_adiantamento) > 0 && (
                <InfoRow label="Adiantamento" value={formatBRL(Number(doc.valor_adiantamento))} />
              )}
              <div className="flex justify-between text-sm font-bold pt-1 border-t">
                <span>Total</span>
                <span>{formatBRL(valorTotal)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Datas */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Histórico
            </p>
            <div className="space-y-2">
              <InfoRow
                label="Gerado em"
                value={format(new Date(doc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              />
              {doc.d4sign_sent_at && (
                <InfoRow
                  label="Enviado para assinatura"
                  value={format(new Date(doc.d4sign_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                />
              )}
              {doc.email_sent_at && (
                <InfoRow
                  label="E-mail enviado"
                  value={format(new Date(doc.email_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                />
              )}
              {doc.email_reminder_count > 0 && (
                <InfoRow
                  label="Lembretes enviados"
                  value={String(doc.email_reminder_count)}
                />
              )}
              {doc.d4sign_signed_at && (
                <InfoRow
                  label="Assinado em"
                  value={format(new Date(doc.d4sign_signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                />
              )}
              {doc.d4sign_cancelled_at && (
                <InfoRow
                  label="Cancelado em"
                  value={format(new Date(doc.d4sign_cancelled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                />
              )}
            </div>
          </div>

          {doc.d4sign_error_message && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <strong>Erro:</strong> {doc.d4sign_error_message}
            </div>
          )}

          {/* Ações */}
          <div className="flex flex-col gap-2 pt-2">
            {canResend && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => resendMutation.mutate({ documentId: doc.id, companyId })}
                disabled={resendMutation.isPending}
              >
                <Mail className="h-4 w-4 mr-2" />
                {resendMutation.isPending ? 'Enviando...' : 'Reenviar lembrete'}
              </Button>
            )}

            {doc.signed_file_path && (
              <Button variant="outline" className="w-full" asChild>
                <a href="#" download>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar documento assinado
                </a>
              </Button>
            )}

            {canCancel && (
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive"
                onClick={() =>
                  cancelMutation.mutate({
                    companyId,
                    d4signDocumentUuid: doc.d4sign_document_uuid!,
                  })
                }
                disabled={cancelMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar documento'}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
