import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

interface Area {
  id: string;
  name: string;
}

interface UserCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: Area[];
  onSave: (data: {
    email: string;
    first_name: string;
    last_name: string;
    area_id: string | null;
    roles: string[];
    phone?: string;
  }) => Promise<void>;
}

const formSchema = z.object({
  email: z.string().email('Email inválido'),
  first_name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  last_name: z.string().min(2, 'Sobrenome deve ter no mínimo 2 caracteres'),
  area_id: z.union([z.string(), z.null()]),
  roles: z.array(z.string()).min(1, 'Selecione pelo menos um role'),
  phone: z.string().trim().regex(/^\+\d{2,3}\d{9,11}$/, { message: 'Formato inválido. Use +5511999999999' }).nullable().or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

const roleOptions = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'ceo', label: 'CEO' },
  { value: 'diretor', label: 'Diretor' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'colaborador', label: 'Colaborador' },
];

export function UserCreateDialog({
  open,
  onOpenChange,
  areas,
  onSave,
}: UserCreateDialogProps) {
  const [saving, setSaving] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['colaborador']);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      area_id: null,
      roles: ['colaborador'],
      phone: '',
    },
  });

  const handleRoleToggle = (role: string) => {
    const newRoles = selectedRoles.includes(role)
      ? selectedRoles.filter((r) => r !== role)
      : [...selectedRoles, role];
    setSelectedRoles(newRoles);
    setValue('roles', newRoles);
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      await onSave({
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        area_id: data.area_id === 'none' ? null : data.area_id,
        roles: selectedRoles,
        phone: data.phone || undefined,
      });
      reset();
      setSelectedRoles(['colaborador']);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating user:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!saving) {
      if (!newOpen) {
        reset();
        setSelectedRoles(['colaborador']);
      }
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novo Usuário</DialogTitle>
          <DialogDescription>
            Preencha os dados do novo usuário. Um email de boas-vindas será enviado
            automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@exemplo.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nome *</Label>
              <Input
                id="first_name"
                placeholder="Nome"
                {...register('first_name')}
              />
              {errors.first_name && (
                <p className="text-sm text-destructive">
                  {errors.first_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Sobrenome *</Label>
              <Input
                id="last_name"
                placeholder="Sobrenome"
                {...register('last_name')}
              />
              {errors.last_name && (
                <p className="text-sm text-destructive">
                  {errors.last_name.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="area">Área</Label>
            <Select
              value={watch('area_id') || undefined}
              onValueChange={(value) => setValue('area_id', value || null)}
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

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone (WhatsApp)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+5511999999999"
              {...register('phone')}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Formato: +[código][DDD][número]. Ex: +5511999999999
            </p>
          </div>

          <div className="space-y-2">
            <Label>Roles *</Label>
            <div className="space-y-2">
              {roleOptions.map((role) => (
                <div key={role.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`role-${role.value}`}
                    checked={selectedRoles.includes(role.value)}
                    onCheckedChange={() => handleRoleToggle(role.value)}
                  />
                  <Label
                    htmlFor={`role-${role.value}`}
                    className="cursor-pointer"
                  >
                    {role.label}
                  </Label>
                </div>
              ))}
            </div>
            {errors.roles && (
              <p className="text-sm text-destructive">{errors.roles.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Usuário
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
