import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Variable } from 'lucide-react';
import { PLACEHOLDER_GROUPS, PLACEHOLDER_MAP } from './placeholder-extension';
import { useState } from 'react';

interface Props {
  editor: Editor | null;
}

export function PlaceholderMenu({ editor }: Props) {
  const [open, setOpen] = useState(false);

  function insert(key: string) {
    if (!editor) return;
    const label = PLACEHOLDER_MAP.get(key) ?? key;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'templatePlaceholder',
        attrs: { key, label },
      })
      .run();
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs font-medium"
        >
          <Variable className="h-3.5 w-3.5" />
          Inserir campo
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="space-y-3">
          {PLACEHOLDER_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => insert(item.key)}
                    className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
