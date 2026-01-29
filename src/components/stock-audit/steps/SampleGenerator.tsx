import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ArrowRight, Shuffle, Package, Target, Info } from "lucide-react";
import { useStockAudit } from "@/hooks/useStockAudit";
import { Slider } from "@/components/ui/slider";

interface SampleGeneratorProps {
  auditId: string;
  totalItems: number;
  onComplete: () => void;
  onBack: () => void;
}

export function SampleGenerator({ auditId, totalItems, onComplete, onBack }: SampleGeneratorProps) {
  const { generateSample, sampleItems } = useStockAudit(auditId);
  const [sampleSize, setSampleSize] = useState(Math.min(30, totalItems));
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateSample(sampleSize);
      setGenerated(true);
    } finally {
      setGenerating(false);
    }
  };

  const samplePercentage = Math.round((sampleSize / totalItems) * 100);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Amostra de Contagem</h2>
        <p className="text-muted-foreground mt-1">
          Defina quantos itens serão contados nesta auditoria
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Base carregada
          </CardTitle>
          <CardDescription>
            {totalItems} itens disponíveis para amostragem
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sample size selector */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Tamanho da amostra</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={totalItems}
                  value={sampleSize}
                  onChange={(e) => setSampleSize(Math.min(parseInt(e.target.value) || 1, totalItems))}
                  className="w-24 text-center"
                />
                <span className="text-muted-foreground">itens</span>
              </div>
            </div>

            <Slider
              value={[sampleSize]}
              onValueChange={([value]) => setSampleSize(value)}
              min={1}
              max={totalItems}
              step={1}
              className="py-4"
            />

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>1 item</span>
              <Badge variant="secondary" className="font-mono">
                {samplePercentage}% da base
              </Badge>
              <span>{totalItems} itens</span>
            </div>
          </div>

          {/* Sampling method info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Amostragem aleatória:</strong> Os itens serão selecionados de forma aleatória da base importada.
            </AlertDescription>
          </Alert>

          {/* Quick presets */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Presets rápidos</Label>
            <div className="flex flex-wrap gap-2">
              {[10, 30, 50, 100].filter(n => n <= totalItems).map((n) => (
                <Button
                  key={n}
                  variant={sampleSize === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSampleSize(n)}
                >
                  {n} itens
                </Button>
              ))}
              <Button
                variant={sampleSize === totalItems ? "default" : "outline"}
                size="sm"
                onClick={() => setSampleSize(totalItems)}
              >
                100% ({totalItems})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated sample preview */}
      {generated && sampleItems.length > 0 && (
        <Card className="border-green-500/50 bg-green-50/30 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Target className="h-5 w-5" />
              Amostra gerada
            </CardTitle>
            <CardDescription>
              {sampleItems.length} itens selecionados para contagem
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sampleItems.slice(0, 10).map((item) => (
                <Badge key={item.id} variant="secondary" className="font-mono">
                  {item.sku_code}
                </Badge>
              ))}
              {sampleItems.length > 10 && (
                <Badge variant="outline">
                  +{sampleItems.length - 10} mais
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        
        {!generated ? (
          <Button 
            onClick={handleGenerate} 
            disabled={generating || sampleSize < 1}
            size="lg"
          >
            {generating ? "Gerando..." : "Gerar Amostra"}
            <Shuffle className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={onComplete} size="lg">
            Começar Contagem
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
