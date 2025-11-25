import { useState } from 'react';
import { ChevronRight, ChevronDown, Building2, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Area {
  id: string;
  name: string;
  parent_id: string | null;
}

interface AreaTreeNode extends Area {
  children: AreaTreeNode[];
}

interface AreaTreeViewProps {
  areas: Area[];
  onEdit: (area: Area) => void;
  onDelete: (areaId: string) => Promise<void>;
}

function buildTree(areas: Area[]): AreaTreeNode[] {
  const map = new Map<string, AreaTreeNode>();
  const roots: AreaTreeNode[] = [];

  // Create nodes
  areas.forEach(area => {
    map.set(area.id, { ...area, children: [] });
  });

  // Build tree
  areas.forEach(area => {
    const node = map.get(area.id)!;
    if (area.parent_id) {
      const parent = map.get(area.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function TreeNode({ 
  node, 
  level = 0, 
  onEdit, 
  onDelete 
}: { 
  node: AreaTreeNode; 
  level?: number; 
  onEdit: (area: Area) => void;
  onDelete: (areaId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div 
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
        style={{ marginLeft: `${level * 24}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-6" />
        )}
        
        <Building2 className="h-4 w-4 text-primary" />
        
        <span className="flex-1 text-sm font-medium text-foreground">
          {node.name}
        </span>

        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(node)}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(node.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AreaTreeView({ areas, onEdit, onDelete }: AreaTreeViewProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const tree = buildTree(areas);

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    
    setIsDeleting(true);
    try {
      await onDelete(deleteId);
      setDeleteId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (areas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground">
          Nenhuma área cadastrada ainda
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Clique em "Nova Área" para começar
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1">
        {tree.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            onEdit={onEdit}
            onDelete={setDeleteId}
          />
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta área? Esta ação não pode ser desfeita.
              {areas.some(a => a.parent_id === deleteId) && (
                <span className="block mt-2 text-warning font-medium">
                  Atenção: Esta área possui sub-áreas que também serão afetadas.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
