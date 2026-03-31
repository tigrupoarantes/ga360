import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ArrowLeft, Save, Eye, EyeOff, Loader2 } from 'lucide-react';
import { TipTapEditor } from '@/components/template-editor/TipTapEditor';
import { TemplatePreview } from '@/components/template-editor/TemplatePreview';
import { StarterTemplatePicker } from '@/components/template-editor/StarterTemplatePicker';
import { useTemplateEditor } from '@/components/template-editor/useTemplateEditor';

export default function TemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const {
    form,
    updateField,
    setInitialHtml,
    isNew,
    isLoading,
    isDirty,
    canSave,
    isSaving,
    save,
  } = useTemplateEditor(templateId);

  const [showPreview, setShowPreview] = useState(true);
  const [starterOpen, setStarterOpen] = useState(false);

  // Show starter picker when creating a new template and no content yet
  useEffect(() => {
    if (isNew && !form.template_html) {
      setStarterOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  // Warn about unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-4 py-2.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate('/admin/d4sign')}
          title="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <Input
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Nome do template"
          className="max-w-xs h-8 text-sm font-medium"
        />

        <Input
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Descricao (opcional)"
          className="max-w-xs h-8 text-sm text-muted-foreground"
        />

        <div className="flex items-center gap-2 ml-2">
          <Switch
            id="tpl-active"
            checked={form.is_active}
            onCheckedChange={(v) => updateField('is_active', v)}
          />
          <Label htmlFor="tpl-active" className="text-xs">
            Ativo
          </Label>
        </div>

        <div className="flex-1" />

        {/* Status indicator */}
        {isDirty ? (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
            Alteracoes nao salvas
          </Badge>
        ) : !isNew ? (
          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
            Salvo
          </Badge>
        ) : null}

        {/* Toggle preview */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ocultar preview</span>
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mostrar preview</span>
            </>
          )}
        </Button>

        {/* Save */}
        <Button size="sm" onClick={save} disabled={!canSave} className="gap-1.5">
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </header>

      {/* Main area: editor + preview */}
      <div className="flex-1 overflow-hidden">
        {showPreview ? (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={55} minSize={35}>
              <TipTapEditor
                content={form.template_html}
                onChange={(html) => updateField('template_html', html)}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={45} minSize={25}>
              <TemplatePreview html={form.template_html} />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <TipTapEditor
            content={form.template_html}
            onChange={(html) => updateField('template_html', html)}
          />
        )}
      </div>

      {/* Starter template picker for new templates */}
      <StarterTemplatePicker
        open={starterOpen}
        onSelect={(html) => {
          setInitialHtml(html);
          setStarterOpen(false);
        }}
        onClose={() => setStarterOpen(false)}
      />
    </div>
  );
}
