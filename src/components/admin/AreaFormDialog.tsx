import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

interface Area {
  id: string;
  name: string;
  parent_id: string | null;
  cost_center?: string | null;
}

interface AreaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  area: Area | null;
  areas: Area[];
  onSave: (data: { name: string; parent_id: string | null; cost_center: string | null }) => Promise<void>;
  companyId?: string | null;
}

const areaSchema = z.object({
  name: z.string().trim().min(2, { message: 'Nome deve ter no mínimo 2 caracteres' }),
  parent_id: z.union([z.string(), z.null()]),
  cost_center: z.union([z.string().trim(), z.null()]).transform(val => val === '' ? null : val),
});

export function AreaFormDialog({ 
  open, 
  onOpenChange, 
  area, 
  areas,
  onSave,
  companyId 
}: AreaFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    parent_id: null as string | null,
    cost_center: '' as string,
  });

  useEffect(() => {
    if (open) {
      if (area) {
        setFormData({
          name: area.name,
          parent_id: area.parent_id,
          cost_center: area.cost_center || '',
        });
      } else {
        setFormData({
          name: '',
          parent_id: null,
          cost_center: '',
        });
      }
      setErrors({});
    }
  }, [open, area]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const validated = areaSchema.parse(formData) as { name: string; parent_id: string | null; cost_center: string | null };
      await onSave(validated);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter out current area and its descendants from parent options
  const availableParents = area
    ? areas.filter(a => {
        if (a.id === area.id) return false;
        // Check if it's a descendant
        let current: Area | undefined = a;
        while (current?.parent_id) {
          if (current.parent_id === area.id) return false;
          current = areas.find(x => x.id === current?.parent_id);
          if (!current) break;
        }
        return true;
      })
    : areas;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {area ? 'Editar Área' : 'Nova Área'}
            </DialogTitle>
            <DialogDescription>
              {area 
                ? 'Atualize as informações da área'
                : 'Crie uma nova área ou departamento'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Área *</Label>
              <Input
                id="name"
                placeholder="Ex: Marketing, Vendas, TI"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost_center">Centro de Custo</Label>
              <Input
                id="cost_center"
                placeholder="Ex: 1001, CC-VENDAS"
                value={formData.cost_center}
                onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Código conforme cadastrado no ERP
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent">Área Superior (opcional)</Label>
              <Select
                value={formData.parent_id || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, parent_id: value === 'none' ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a área superior" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (área raiz)</SelectItem>
                  {availableParents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Defina uma hierarquia organizando áreas dentro de outras
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                area ? 'Salvar alterações' : 'Criar área'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
