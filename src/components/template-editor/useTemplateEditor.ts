import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

interface TemplateForm {
  name: string;
  description: string;
  template_html: string;
  is_active: boolean;
}

const INITIAL_FORM: TemplateForm = {
  name: '',
  description: '',
  template_html: '',
  is_active: true,
};

/**
 * Hook that manages the full template editor state:
 * - Loads existing template by ID
 * - Tracks form state and dirty detection
 * - Save mutation via save-d4sign-template edge function
 */
export function useTemplateEditor(templateId: string | undefined) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const companyId = selectedCompany?.id ?? '';

  const [form, setForm] = useState<TemplateForm>(INITIAL_FORM);
  const [isDirty, setIsDirty] = useState(false);
  const savedHtmlRef = useRef('');

  // Determine if we're editing an existing template
  const isNew = !templateId || templateId === 'new';

  // Load existing template
  const { data: existingTemplate, isLoading } = useQuery({
    queryKey: ['d4sign-template-detail', templateId],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Nao autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-d4sign-templates`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ companyId }),
        },
      );

      if (!response.ok) throw new Error('Falha ao carregar templates');
      const result = await response.json();
      const templates = result.templates ?? [];
      return templates.find((t: { id: string }) => t.id === templateId) ?? null;
    },
    enabled: !isNew && !!companyId,
  });

  // Populate form when template loads
  useEffect(() => {
    if (existingTemplate) {
      const loaded: TemplateForm = {
        name: existingTemplate.name ?? '',
        description: existingTemplate.description ?? '',
        template_html: existingTemplate.template_html ?? '',
        is_active: existingTemplate.is_active ?? true,
      };
      setForm(loaded);
      savedHtmlRef.current = loaded.template_html;
      setIsDirty(false);
    }
  }, [existingTemplate]);

  // Update a single form field
  const updateField = useCallback(
    <K extends keyof TemplateForm>(field: K, value: TemplateForm[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setIsDirty(true);
    },
    [],
  );

  // Set initial HTML (from starter template picker)
  const setInitialHtml = useCallback((html: string) => {
    setForm((prev) => ({ ...prev, template_html: html }));
    savedHtmlRef.current = '';
    setIsDirty(true);
  }, []);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Nao autenticado');

      const payload: Record<string, unknown> = {
        companyId,
        template: {
          company_id: companyId,
          name: form.name,
          description: form.description,
          template_html: form.template_html,
          is_active: form.is_active,
        },
      };

      if (!isNew) {
        payload.templateId = templateId;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-d4sign-template`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao salvar template');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Template salvo com sucesso');
      savedHtmlRef.current = form.template_html;
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['d4sign-templates'] });
      queryClient.invalidateQueries({ queryKey: ['d4sign-template-detail', templateId] });
      // Após criar novo template, redirecionar para a lista na aba correta
      if (isNew) {
        navigate('/admin/d4sign?tab=templates');
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  const canSave = !!form.name && !!form.template_html && !saveMutation.isPending;

  return {
    form,
    updateField,
    setInitialHtml,
    isNew,
    isLoading,
    isDirty,
    canSave,
    isSaving: saveMutation.isPending,
    save: () => saveMutation.mutate(),
  };
}
