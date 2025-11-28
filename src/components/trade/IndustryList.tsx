import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Package, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { IndustryFormDialog } from "./IndustryFormDialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface IndustryListProps {
  selectedIndustryId: string | null;
  onSelectIndustry: (id: string | null) => void;
}

export function IndustryList({ selectedIndustryId, onSelectIndustry }: IndustryListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState<any>(null);
  const [deletingIndustry, setDeletingIndustry] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: industries, isLoading } = useQuery({
    queryKey: ["trade-industries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_industries")
        .select(`
          *,
          companies(name),
          trade_materials(count)
        `)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async () => {
    if (!deletingIndustry) return;
    
    try {
      const { error } = await supabase
        .from("trade_industries")
        .update({ is_active: false })
        .eq("id", deletingIndustry.id);
      
      if (error) throw error;
      
      toast({ title: "Indústria removida com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["trade-industries"] });
      
      if (selectedIndustryId === deletingIndustry.id) {
        onSelectIndustry(null);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao remover indústria",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingIndustry(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Indústrias
          </h3>
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Indústrias
        </h3>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova
        </Button>
      </div>

      <div className="space-y-2">
        <Card
          className={cn(
            "p-3 cursor-pointer transition-colors hover:bg-accent",
            selectedIndustryId === null && "ring-2 ring-primary"
          )}
          onClick={() => onSelectIndustry(null)}
        >
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Todas</span>
          </div>
        </Card>

        {industries?.map((industry) => (
          <Card
            key={industry.id}
            className={cn(
              "p-3 cursor-pointer transition-colors hover:bg-accent group",
              selectedIndustryId === industry.id && "ring-2 ring-primary"
            )}
            onClick={() => onSelectIndustry(industry.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium truncate">{industry.name}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {(industry.trade_materials as any)?.[0]?.count || 0} materiais
                  </Badge>
                  {industry.companies?.name && (
                    <span className="text-xs text-muted-foreground truncate">
                      {industry.companies.name}
                    </span>
                  )}
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    setEditingIndustry(industry);
                    setShowForm(true);
                  }}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingIndustry(industry);
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remover
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
        ))}

        {industries?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma indústria cadastrada</p>
          </div>
        )}
      </div>

      <IndustryFormDialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditingIndustry(null);
        }}
        industry={editingIndustry}
      />

      <AlertDialog open={!!deletingIndustry} onOpenChange={() => setDeletingIndustry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover indústria?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá desativar a indústria "{deletingIndustry?.name}" e todos os seus materiais.
              Esta ação pode ser revertida posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
