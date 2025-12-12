import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface InviteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Company {
  id: string;
  name: string;
}

interface Area {
  id: string;
  name: string;
}

const AVAILABLE_ROLES = [
  { value: 'colaborador', label: 'Colaborador' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'diretor', label: 'Diretor' },
  { value: 'ceo', label: 'CEO' },
];

export function InviteFormDialog({ open, onOpenChange, onSuccess }: InviteFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    companyId: '',
    areaId: '',
    roles: ['colaborador'] as string[],
  });

  useEffect(() => {
    if (open) {
      fetchCompanies();
      fetchAreas();
    }
  }, [open]);

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('id, name').eq('is_active', true);
    if (data) setCompanies(data);
  };

  const fetchAreas = async () => {
    const { data } = await supabase.from('areas').select('id, name');
    if (data) setAreas(data);
  };

  const handleRoleChange = (role: string, checked: boolean) => {
    if (checked) {
      setFormData({ ...formData, roles: [...formData.roles, role] });
    } else {
      setFormData({ ...formData, roles: formData.roles.filter((r) => r !== role) });
    }
  };

  const handleSubmit = async () => {
    if (!formData.email) {
      toast({ title: 'Email é obrigatório', variant: 'destructive' });
      return;
    }

    if (formData.roles.length === 0) {
      toast({ title: 'Selecione ao menos um perfil', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Create invite
      const { data: invite, error: insertError } = await supabase
        .from('user_invites')
        .insert({
          email: formData.email,
          first_name: formData.firstName || null,
          last_name: formData.lastName || null,
          company_id: formData.companyId || null,
          area_id: formData.areaId || null,
          roles: formData.roles,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Send invite email
      const { error: sendError } = await supabase.functions.invoke('send-invite', {
        body: {
          inviteId: invite.id,
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          roles: formData.roles,
          appUrl: window.location.origin,
        },
      });

      if (sendError) {
        console.error('Email send error:', sendError);
        toast({
          title: 'Convite criado, mas email não enviado',
          description: 'O convite foi registrado, mas houve erro ao enviar o email.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Convite enviado!',
          description: `Email de convite enviado para ${formData.email}`,
        });
      }

      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        companyId: '',
        areaId: '',
        roles: ['colaborador'],
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating invite:', error);
      toast({
        title: 'Erro ao criar convite',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar Novo Usuário</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input
                id="firstName"
                placeholder="Nome"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input
                id="lastName"
                placeholder="Sobrenome"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select
              value={formData.companyId}
              onValueChange={(value) => setFormData({ ...formData, companyId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Área/Departamento</Label>
            <Select
              value={formData.areaId}
              onValueChange={(value) => setFormData({ ...formData, areaId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a área" />
              </SelectTrigger>
              <SelectContent>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Perfis *</Label>
            <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg">
              {AVAILABLE_ROLES.map((role) => (
                <div key={role.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={role.value}
                    checked={formData.roles.includes(role.value)}
                    onCheckedChange={(checked) => handleRoleChange(role.value, !!checked)}
                  />
                  <Label htmlFor={role.value} className="text-sm font-normal cursor-pointer">
                    {role.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar Convite'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
