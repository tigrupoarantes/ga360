import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import UnderlineExt from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { TemplatePlaceholder, preprocessLegacyHtml } from './placeholder-extension';
import { EditorToolbar } from './EditorToolbar';

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function TipTapEditor({ content, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      UnderlineExt,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Comece a digitar o conteudo do template...',
      }),
      TemplatePlaceholder,
    ],
    content: preprocessLegacyHtml(content),
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-6 py-4',
      },
    },
  });

  // Sync external content changes (e.g., loading a template or picking a starter)
  useEffect(() => {
    if (!editor) return;
    const processed = preprocessLegacyHtml(content);
    const currentHtml = editor.getHTML();
    // Only reset if significantly different (avoid cursor jump on every keystroke)
    if (processed !== currentHtml && content !== currentHtml) {
      editor.commands.setContent(processed, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  return (
    <div className="border rounded-lg overflow-hidden bg-background flex flex-col h-full">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
      {/* CSS for placeholder nodes inside the editor */}
      <style>{`
        .tiptap .template-placeholder {
          display: inline-flex;
          align-items: center;
          padding: 1px 6px;
          margin: 0 1px;
          border-radius: 4px;
          background-color: hsl(213 94% 95%);
          color: hsl(213 94% 35%);
          font-size: 0.8em;
          font-weight: 500;
          border: 1px solid hsl(213 94% 85%);
          vertical-align: baseline;
          user-select: none;
          cursor: default;
        }
        .dark .tiptap .template-placeholder {
          background-color: hsl(213 40% 15%);
          color: hsl(213 80% 70%);
          border-color: hsl(213 40% 30%);
        }
        .tiptap .template-placeholder.ProseMirror-selectednode {
          outline: 2px solid hsl(213 94% 55%);
          outline-offset: 1px;
        }
        .tiptap p.is-editor-empty:first-child::before {
          color: hsl(var(--muted-foreground));
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
