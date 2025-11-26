import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Badge } from '@/components/ui/badge';
import { z } from 'zod';

interface Area {
  id: string;
  name: string;
}

interface UserRole {
  id: string;
  role: string;
}

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  area_id: string | null;
  is_active: boolean;
  email?: string;
  roles?: string[];
  phone?: string | null;
}

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  areas: Area[];
  onSave: (data: {
    first_name: string;
    last_name: string;
    area_id: string | null;
    is_active: boolean;
    roles: string[];
    phone?: string | null;
  }) => Promise<void>;
}

const userSchema = z.object({
  first_name: z.string().trim().min(2, { message: 'Nome deve ter no mínimo 2 caracteres' }),
  last_name: z.string().trim().min(2, { message: 'Sobrenome deve ter no mínimo 2 caracteres' }),
  area_id: z.union([z.string(), z.null()]),
  is_active: z.boolean(),
  roles: z.array(z.string()).min(1, { message: 'Selecione pelo menos um role' }),
  phone: z.string().trim().regex(/^\+\d{2,3}\d{9,11}$/, { message: 'Formato inválido. Use +5511999999999' }).nullable().or(z.literal('')),
});

const availableRoles = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'ceo', label: 'CEO' },
  { value: 'diretor', label: 'Diretor' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'colaborador', label: 'Colaborador' },
];

export function UserEditDialog({
  open,
  onOpenChange,
  user,
  areas,
  onSave,
}: UserEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    area_id: null as string | null,
    is_active: true,
    roles: [] as string[],
    phone: '',
  });

  useEffect(() => {
    if (open && user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        area_id: user.area_id,
        is_active: user.is_active,
        roles: user.roles || [],
        phone: user.phone || '',
      });
      setErrors({});
    }
  }, [open, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const validated = userSchema.parse(formData) as {
        first_name: string;
        last_name: string;
        area_id: string | null;
        is_active: boolean;
        roles: string[];
        phone?: string | null;
      };
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

  const toggleRole = (role: string) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações e permissões do usuário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* User Info */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">
                Email: {user.email}
              </p>
              <p className="text-xs text-muted-foreground">ID: {user.id}</p>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nome *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  className={errors.first_name ? 'border-destructive' : ''}
                />
                {errors.first_name && (
                  <p className="text-sm text-destructive">{errors.first_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">Sobrenome *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  className={errors.last_name ? 'border-destructive' : ''}
                />
                {errors.last_name && (
                  <p className="text-sm text-destructive">{errors.last_name}</p>
                )}
              </div>
            </div>

            {/* Area Selection */}
            <div className="space-y-2">
              <Label htmlFor="area">Área</Label>
              <Select
                value={formData.area_id || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, area_id: value === 'none' ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma área</SelectItem>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (WhatsApp)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+5511999999999"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className={errors.phone ? 'border-destructive' : ''}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Formato: +[código][DDD][número]. Ex: +5511999999999
              </p>
            </div>

            {/* Roles */}
            <div className="space-y-2">
              <Label>Permissões (Roles) *</Label>
              <div className="flex flex-wrap gap-2">
                {availableRoles.map((role) => (
                  <Badge
                    key={role.value}
                    variant={
                      formData.roles.includes(role.value) ? 'default' : 'outline'
                    }
                    className="cursor-pointer"
                    onClick={() => toggleRole(role.value)}
                  >
                    {role.label}
                  </Badge>
                ))}
              </div>
              {errors.roles && (
                <p className="text-sm text-destructive">{errors.roles}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Clique para adicionar/remover roles
              </p>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Status da Conta</Label>
                <p className="text-xs text-muted-foreground">
                  Usuários inativos não podem acessar o sistema
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
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
                'Salvar alterações'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
