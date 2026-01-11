import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, GripVertical } from "lucide-react";

interface ChecklistItem {
  id?: string;
  text: string;
  is_required: boolean;
  order_index: number;
}

interface ChecklistEditorProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}

export function ChecklistEditor({ items, onChange }: ChecklistEditorProps) {
  const [newItemText, setNewItemText] = useState("");

  const addItem = () => {
    if (!newItemText.trim()) return;
    
    const newItem: ChecklistItem = {
      text: newItemText.trim(),
      is_required: false,
      order_index: items.length,
    };
    
    onChange([...items, newItem]);
    setNewItemText("");
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems.map((item, i) => ({ ...item, order_index: i })));
  };

  const toggleRequired = (index: number) => {
    const newItems = items.map((item, i) => 
      i === index ? { ...item, is_required: !item.is_required } : item
    );
    onChange(newItems);
  };

  const updateText = (index: number, text: string) => {
    const newItems = items.map((item, i) => 
      i === index ? { ...item, text } : item
    );
    onChange(newItems);
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length) return;
    
    const newItems = [...items];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);
    
    onChange(newItems.map((item, i) => ({ ...item, order_index: i })));
  };

  return (
    <Card className="p-4 space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum item no checklist. Adicione itens abaixo.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-muted/50 rounded-md"
            >
              <button
                type="button"
                className="cursor-grab hover:text-foreground text-muted-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => moveItem(index, index - 1)}
              >
                <GripVertical className="h-4 w-4" />
              </button>
              
              <Input
                value={item.text}
                onChange={(e) => updateText(index, e.target.value)}
                className="flex-1"
                placeholder="Texto do item"
              />
              
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={item.is_required}
                    onCheckedChange={() => toggleRequired(index)}
                  />
                  Obrigatório
                </label>
                
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          placeholder="Novo item do checklist"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addItem}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>
    </Card>
  );
}
