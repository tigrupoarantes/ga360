import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2 } from "lucide-react";
import { ReportExamples } from "./ReportExamples";
import { toast } from "sonner";

interface ReportAssistantProps {
  onReportGenerated: (content: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report`;

export function ReportAssistant({
  onReportGenerated,
  isLoading,
  setIsLoading,
}: ReportAssistantProps) {
  const [query, setQuery] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleGenerate = async (customQuery?: string) => {
    const finalQuery = customQuery || query;
    if (!finalQuery.trim()) {
      toast.error("Digite uma solicitação de relatório");
      return;
    }

    setIsLoading(true);
    onReportGenerated(""); // Clear previous report

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query: finalQuery }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Limite de requisições excedido. Tente novamente mais tarde.");
          return;
        }
        if (response.status === 402) {
          toast.error("Créditos de IA esgotados. Adicione créditos para continuar.");
          return;
        }
        throw new Error(`Error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let reportContent = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              reportContent += content;
              onReportGenerated(reportContent);
            }
          } catch {
            // Incomplete JSON, put it back
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Flush remaining buffer
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              reportContent += content;
              onReportGenerated(reportContent);
            }
          } catch {
            /* ignore */
          }
        }
      }

      if (reportContent) {
        toast.success("Relatório gerado com sucesso!");
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        toast.info("Geração cancelada");
      } else {
        console.error("Error generating report:", error);
        toast.error("Erro ao gerar relatório. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleExampleSelect = (exampleQuery: string) => {
    setQuery(exampleQuery);
    handleGenerate(exampleQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          Assistente de Relatórios
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Descreva o relatório que você precisa. Posso analisar reuniões, tarefas, participação, e
          gerar insights com gráficos.
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Sugestões rápidas:</p>
          <ReportExamples onSelect={handleExampleSelect} disabled={isLoading} />
        </div>

        <div className="flex gap-2">
          <Textarea
            placeholder="Ex: Gere um relatório de reuniões do mês de novembro com gráficos de status e tipo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="min-h-[80px] resize-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          {isLoading ? (
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
          ) : null}
          <Button onClick={() => handleGenerate()} disabled={isLoading || !query.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Gerar Relatório
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
