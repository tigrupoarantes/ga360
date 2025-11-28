import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package, ArrowDownToLine, ArrowUpFromLine, AlertTriangle } from "lucide-react";
import { MaterialFormDialog } from "./MaterialFormDialog";
import { MovementFormDialog } from "./MovementFormDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCompany } from "@/contexts/CompanyContext";

const CATEGORY_LABELS: Record<string, string> = {
  display: "Display",
  banner: "Banner",
  wobbler: "Wobbler",
  faixa: "Faixa de Gôndola",
  totem: "Totem",
  adesivo: "Adesivo",
  stopper: "Stopper",
  testeira: "Testeira",
  outro: "Outro",
};

interface MaterialListProps {
  selectedIndustryId: string | null;
}

export function MaterialList({ selectedIndustryId }: MaterialListProps) {
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [movementType, setMovementType] = useState<"entrada" | "saida" | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const { selectedCompanyId } = useCompany();

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["trade-inventory-balance", selectedIndustryId, selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from("trade_inventory_balance")
        .select("*");
      
      if (selectedIndustryId) {
        query = query.eq("industry_id", selectedIndustryId);
      }
      
      if (selectedCompanyId) {
        query = query.or(`company_id.eq.${selectedCompanyId},company_id.is.null`);
      }
      
      const { data, error } = await query.order("material_name");
      if (error) throw error;
      return data;
    },
  });

  const filteredInventory = inventory?.filter((item) => {
    if (categoryFilter !== "all" && item.category !== categoryFilter) {
      return false;
    }
    return true;
  });

  const categories = [...new Set(inventory?.map((item) => item.category) || [])];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="h-4 w-4" />
            Estoque Atual
          </h3>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowMaterialForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Material
          </Button>
          <Button onClick={() => setMovementType("entrada")}>
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Entrada
          </Button>
          <Button variant="secondary" onClick={() => setMovementType("saida")}>
            <ArrowUpFromLine className="h-4 w-4 mr-2" />
            Saída
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Indústria</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead>Última Mov.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInventory?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum material encontrado</p>
                  <Button 
                    variant="link" 
                    className="mt-2"
                    onClick={() => setShowMaterialForm(true)}
                  >
                    Cadastrar primeiro material
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredInventory?.map((item) => (
                <TableRow key={`${item.material_id}-${item.company_id}`}>
                  <TableCell>
                    <div className="font-medium">{item.material_name}</div>
                    <div className="text-xs text-muted-foreground">{item.unit}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{item.industry_name || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {Number(item.current_stock) <= 0 && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                      <span className={Number(item.current_stock) <= 0 ? "text-destructive font-medium" : "font-medium"}>
                        {item.current_stock}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.last_movement ? (
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(item.last_movement), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <MaterialFormDialog
        open={showMaterialForm}
        onOpenChange={setShowMaterialForm}
        preselectedIndustryId={selectedIndustryId || undefined}
      />

      {movementType && (
        <MovementFormDialog
          open={!!movementType}
          onOpenChange={() => setMovementType(null)}
          movementType={movementType}
        />
      )}
    </div>
  );
}
