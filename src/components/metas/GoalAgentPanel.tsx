import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, MessageSquare, Send, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/external-client";
import { useToast } from "@/hooks/use-toast";
import { EXTERNAL_SUPABASE_CONFIG } from "@/config/supabase.config";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface GoalAgentPanelProps {
  companyId: string | null;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onMutationComplete?: () => void;
}

interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_name: string | null;
  created_at: string;
}

type AgentErrorCode =
  | "AUTH_INVALID"
  | "INPUT_INVALID"
  | "PERMISSION_DENIED"
  | "TENANT_ACCESS_DENIED"
  | "CONFIG_MISSING"
  | "PROVIDER_AUTH"
  | "PROVIDER_QUOTA"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_MODEL_NOT_FOUND"
  | "PROVIDER_REQUEST_FAILED"
  | "INTERNAL_ERROR";

function getFriendlyErrorMessage(code?: string, fallback?: string) {
  const normalized = (code || "") as AgentErrorCode;
  const mapping: Partial<Record<AgentErrorCode, string>> = {
    AUTH_INVALID: "Sua sessão expirou. Faça login novamente para continuar.",
    INPUT_INVALID: "A solicitação enviada está incompleta. Ajuste e tente novamente.",
    PERMISSION_DENIED: "Você não tem permissão para executar esta ação em metas.",
    TENANT_ACCESS_DENIED: "Você não tem acesso à empresa selecionada.",
    CONFIG_MISSING: "Configuração de IA ausente. Verifique o provedor e a API key nas configurações.",
    PROVIDER_AUTH: "Falha de autenticação no provedor de IA. Verifique a API key configurada.",
    PROVIDER_QUOTA: "A cota/crédito do provedor de IA foi atingida. Ajuste o plano ou troque de provedor.",
    PROVIDER_RATE_LIMIT: "O provedor de IA está com limite temporário. Tente novamente em alguns segundos.",
    PROVIDER_UNAVAILABLE: "O provedor de IA está indisponível no momento. Tente novamente em instantes.",
    PROVIDER_MODEL_NOT_FOUND: "O modelo configurado não está disponível. Ajuste o modelo nas configurações.",
  };

  return mapping[normalized] || fallback || "Não foi possível processar sua solicitação no momento.";
}

async function parseFunctionError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string; message?: string; code?: string };
    return {
      code: payload.code,
      message:
        getFriendlyErrorMessage(payload.code, payload.error || payload.message) ||
        `Falha na chamada (${response.status})`,
    };
  } catch {
    const fallbackText = await response.text().catch(() => "");
    return {
      code: undefined,
      message: fallbackText || `Falha na chamada (${response.status})`,
    };
  }
}

async function callAssistantEndpoint(params: {
  endpoint: "ai-gateway" | "goal-assistant";
  accessToken: string;
  companyId: string;
  prompt: string;
}) {
  const response = await fetch(`${EXTERNAL_SUPABASE_CONFIG.url}/functions/v1/${params.endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EXTERNAL_SUPABASE_CONFIG.anonKey,
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      companyId: params.companyId,
      message: params.prompt,
      module: "metas",
    }),
  });

  return response;
}

async function getValidAccessToken() {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  let {
    data: { session },
  } = await supabase.auth.getSession();

  const isExpiredOrCloseToExpire = !session?.expires_at || session.expires_at <= nowInSeconds + 60;

  if (!session || isExpiredOrCloseToExpire) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data?.session?.access_token) {
      throw new Error("Sua sessão expirou. Faça login novamente para usar o copiloto de metas.");
    }
    session = data.session;
  }

  const token = session.access_token?.trim();
  if (!token) {
    throw new Error("Não foi possível validar sua sessão. Faça login novamente.");
  }

  return token;
}

export function GoalAgentPanel({ companyId, open, onOpenChange, onMutationComplete }: GoalAgentPanelProps) {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [agentStep, setAgentStep] = useState<"idle" | "auth" | "request" | "processing">("idle");

  const quickPrompts = [
    "Crie uma meta de crescimento de vendas de 10% para o próximo mês.",
    "Liste minhas metas ativas com prazo mais próximo.",
    "Atualize o progresso da meta de faturamento para 65%.",
  ];

  const messagesQuery = useQuery({
    queryKey: ["metas", "agent-messages", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goal_agent_messages" as never)
        .select("id, role, content, tool_name, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw error;
      return (data || []) as AgentMessage[];
    },
    refetchOnWindowFocus: false,
  });

  const sortedMessages = useMemo(() => messagesQuery.data || [], [messagesQuery.data]);

  const sendMutation = useMutation({
    mutationFn: async (prompt: string) => {
      if (!companyId) throw new Error("Selecione uma empresa");
      if (!prompt.trim()) throw new Error("Digite uma mensagem");

      setAgentStep("auth");
      const accessToken = await getValidAccessToken();

      setAgentStep("request");
      let response = await callAssistantEndpoint({
        endpoint: "ai-gateway",
        accessToken,
        companyId,
        prompt: prompt.trim(),
      });

      if (!response.ok && (response.status === 404 || response.status === 500)) {
        response = await callAssistantEndpoint({
          endpoint: "goal-assistant",
          accessToken,
          companyId,
          prompt: prompt.trim(),
        });
      }

      if (!response.ok) {
        const functionError = await parseFunctionError(response);
        throw new Error(functionError.message);
      }

      setAgentStep("processing");
      const data = (await response.json()) as { success?: boolean; reply?: string; error?: string };
      return data;
    },
    onMutate: (prompt) => {
      setInput("");
      return { prompt };
    },
    onSuccess: () => {
      messagesQuery.refetch();
      onMutationComplete?.();
      setAgentStep("idle");
    },
    onError: (error, _vars, context) => {
      const maybePrompt = context?.prompt;
      if (maybePrompt) {
        setInput(maybePrompt);
      }
      toast({
        title: "Erro no assistente",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      setAgentStep("idle");
    },
  });

  useEffect(() => {
    if (!companyId) setInput("");
  }, [companyId]);

  const sendCurrentInput = () => {
    if (!sendMutation.isPending && input.trim()) {
      sendMutation.mutate(input);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] max-w-[92vw] p-0">
        <Card className="h-full rounded-none border-0 p-4 flex flex-col gap-3 shadow-none">
          <SheetHeader className="space-y-0 border-b pb-3 pr-8">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-sm">Copiloto de Metas</SheetTitle>
                <p className="text-[11px] text-muted-foreground">Assistente IA operacional</p>
              </div>
            </div>
            <Badge variant="outline">Pronto</Badge>
          </SheetHeader>

          {!companyId ? (
            <div className="flex-1 text-sm text-muted-foreground flex items-center justify-center text-center px-3">
              Selecione uma empresa para habilitar o assistente de metas.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                Converse em linguagem natural para criar, atualizar ou consultar metas.
              </div>

              <div className="flex-1 overflow-y-auto border rounded-md p-2.5 space-y-2 bg-muted/20">
                {messagesQuery.isLoading ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
                  </div>
                ) : sortedMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm text-center px-2 gap-3">
                    <p>Comece com um comando rápido:</p>
                    <div className="w-full space-y-2">
                      {quickPrompts.map((prompt) => (
                        <Button
                          key={prompt}
                          type="button"
                          variant="outline"
                          className="w-full text-left justify-start h-auto py-2 whitespace-normal"
                          onClick={() => {
                            setInput(prompt);
                          }}
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  sortedMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-md px-2.5 py-2 text-xs whitespace-pre-wrap ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground ml-8"
                          : message.role === "assistant"
                          ? "bg-background border mr-3"
                          : "bg-muted border mr-3"
                      }`}
                    >
                      {message.role === "tool" && message.tool_name && (
                        <p className="font-medium mb-1 text-[11px]">Tool: {message.tool_name}</p>
                      )}
                      {message.content}
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Escreva sua solicitação..."
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendCurrentInput();
                    }
                  }}
                  disabled={sendMutation.isPending}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={sendCurrentInput}
                  disabled={sendMutation.isPending || !input.trim()}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {sendMutation.isPending && (
                <p className="text-[11px] text-muted-foreground">
                  {agentStep === "auth"
                    ? "Validando sua sessão..."
                    : agentStep === "request"
                    ? "Conectando com o agente..."
                    : "Processando solicitação do agente..."}
                </p>
              )}
            </>
          )}
        </Card>
      </SheetContent>
    </Sheet>
  );
}
