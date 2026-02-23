import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/external-client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";

interface EditEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    position: string | null;
    unidade: string | null;
    cpf: string | null;
    registration_number: string | null;
    cod_vendedor: string | null;
    is_condutor: boolean;
    company_id: string | null;
    hire_date: string | null;
    birth_date: string | null;
    gender: string | null;
    age: number | null;
    first_job: boolean | null;
    education_level: string | null;
    marital_status: string | null;
    is_disabled: boolean | null;
  } | null;
  onSuccess: () => void;
}

export function EditEmployeeDialog({ open, onOpenChange, employee, onSuccess }: EditEmployeeDialogProps) {
  const { companies } = useCompany();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    department: "",
    position: "",
    unidade: "",
    cpf: "",
    registration_number: "",
    cod_vendedor: "",
    is_condutor: false,
    company_id: "",
    hire_date: "",
    birth_date: "",
    gender: "",
    age: "",
    first_job: "",
    education_level: "",
    marital_status: "",
    is_disabled: "",
  });

  useEffect(() => {
    if (employee) {
      setForm({
        full_name: employee.full_name || "",
        email: employee.email || "",
        phone: employee.phone || "",
        department: employee.department || "",
        position: employee.position || "",
        unidade: employee.unidade || "",
        cpf: employee.cpf || "",
        registration_number: employee.registration_number || "",
        cod_vendedor: employee.cod_vendedor || "",
        is_condutor: employee.is_condutor || false,
        company_id: employee.company_id || "",
        hire_date: employee.hire_date ? employee.hire_date.split("T")[0] : "",
        birth_date: employee.birth_date ? employee.birth_date.split("T")[0] : "",
        gender: employee.gender || "",
        age: employee.age !== null && employee.age !== undefined ? String(employee.age) : "",
        first_job: employee.first_job === null ? "" : employee.first_job ? "sim" : "nao",
        education_level: employee.education_level || "",
        marital_status: employee.marital_status || "",
        is_disabled: employee.is_disabled === null ? "" : employee.is_disabled ? "sim" : "nao",
      });
    }
  }, [employee]);

  const handleSave = async () => {
    if (!employee) return;
    if (!form.full_name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("external_employees")
        .update({
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          department: form.department.trim() || null,
          position: form.position.trim() || null,
          unidade: form.unidade.trim() || null,
          cpf: form.cpf.trim() || null,
          registration_number: form.registration_number.trim() || null,
          cod_vendedor: form.cod_vendedor.trim() || null,
          is_condutor: form.is_condutor,
          company_id: form.company_id || null,
          hire_date: form.hire_date || null,
          birth_date: form.birth_date || null,
          gender: form.gender || null,
          age: form.age ? Number(form.age) : null,
          first_job: form.first_job ? form.first_job === "sim" : null,
          education_level: form.education_level.trim() || null,
          marital_status: form.marital_status.trim() || null,
          is_disabled: form.is_disabled ? form.is_disabled === "sim" : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", employee.id);

      if (error) throw error;

      toast.success("Funcionário atualizado com sucesso");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating employee:", error);
      toast.error("Erro ao atualizar funcionário");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Funcionário</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>Nome Completo *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Matrícula</Label>
            <Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Cód. Vendedor</Label>
            <Input value={form.cod_vendedor} onChange={(e) => setForm({ ...form, cod_vendedor: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Data Admissão</Label>
            <Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Data Nascimento</Label>
            <Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Sexo</Label>
            <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar sexo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MASCULINO">Masculino</SelectItem>
                <SelectItem value="FEMININO">Feminino</SelectItem>
                <SelectItem value="INDEFINIDO">Indefinido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Idade</Label>
            <Input type="number" min={0} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Primeiro Emprego</Label>
            <Select value={form.first_job} onValueChange={(v) => setForm({ ...form, first_job: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Escolaridade</Label>
            <Input value={form.education_level} onChange={(e) => setForm({ ...form, education_level: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Estado Civil</Label>
            <Input value={form.marital_status} onChange={(e) => setForm({ ...form, marital_status: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Deficiente Físico</Label>
            <Select value={form.is_disabled} onValueChange={(v) => setForm({ ...form, is_disabled: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex items-center gap-3 pt-6">
            <Switch checked={form.is_condutor} onCheckedChange={(v) => setForm({ ...form, is_condutor: v })} />
            <Label>É condutor</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
