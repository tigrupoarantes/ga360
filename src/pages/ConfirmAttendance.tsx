import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2, Calendar, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ConfirmAttendance() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(true);
  const [meeting, setMeeting] = useState<any>(null);
  const [status, setStatus] = useState<string | null>(null);

  const token = searchParams.get("token");
  const action = searchParams.get("action");

  useEffect(() => {
    if (!token) {
      toast({
        title: "Link inválido",
        description: "Token de confirmação não encontrado.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    // Se veio com action, processar automaticamente
    if (action === "decline") {
      handleConfirm("decline");
    } else {
      setProcessing(false);
    }
  }, [token, action]);

  const handleConfirm = async (confirmAction: "confirm" | "decline") => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("confirm-attendance", {
        body: {
          token,
          action: confirmAction,
        },
      });

      if (error) throw error;

      setMeeting(data.meeting);
      setStatus(data.status);

      toast({
        title: confirmAction === "confirm" ? "Presença confirmada!" : "Convite recusado",
        description: confirmAction === "confirm" 
          ? "Sua presença foi confirmada com sucesso." 
          : "Sua recusa foi registrada.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao processar confirmação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setProcessing(false);
    }
  };

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
        <Card className="w-full max-w-md">
          <CardContent className="pt-12 pb-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Processando sua resposta...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              {status === "confirmed" ? (
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                  <X className="h-8 w-8 text-red-600" />
                </div>
              )}
            </div>
            <CardTitle>
              {status === "confirmed" ? "Presença Confirmada!" : "Convite Recusado"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {meeting && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h3 className="font-semibold">{meeting.title}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(new Date(meeting.scheduledAt), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {format(new Date(meeting.scheduledAt), "HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>
            )}

            {status === "confirmed" && (
              <p className="text-center text-sm text-muted-foreground">
                Obrigado por confirmar! Você receberá um lembrete antes da reunião.
              </p>
            )}

            <Button
              className="w-full"
              onClick={() => navigate("/")}
            >
              Ir para o sistema
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Confirmação de Presença</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            Você foi convidado para uma reunião. Por favor, confirme sua presença.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => handleConfirm("confirm")}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirmar
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => handleConfirm("decline")}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Recusar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
