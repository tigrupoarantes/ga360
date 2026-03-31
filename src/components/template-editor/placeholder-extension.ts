import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

// Registry of all available placeholders grouped by category
export const PLACEHOLDER_GROUPS = [
  {
    label: 'Funcionario',
    items: [
      { key: 'nome_funcionario', label: 'Nome do Funcionario' },
      { key: 'cpf', label: 'CPF' },
      { key: 'cargo', label: 'Cargo' },
      { key: 'departamento', label: 'Departamento' },
      { key: 'unidade', label: 'Unidade' },
    ],
  },
  {
    label: 'Empresa',
    items: [
      { key: 'empresa', label: 'Empresa' },
      { key: 'grupo_contabilizacao', label: 'Grupo de Contabilizacao' },
    ],
  },
  {
    label: 'Documento',
    items: [
      { key: 'competencia', label: 'Competencia' },
      { key: 'data_geracao', label: 'Data de Geracao' },
    ],
  },
  {
    label: 'Valores',
    items: [
      { key: 'valor_verba', label: 'Valor da Verba' },
      { key: 'valor_adiantamento', label: 'Valor do Adiantamento' },
      { key: 'valor_total', label: 'Valor Total' },
    ],
  },
] as const;

export type PlaceholderKey = (typeof PLACEHOLDER_GROUPS)[number]['items'][number]['key'];

// Flat map for quick lookups
export const PLACEHOLDER_MAP = new Map<string, string>(
  PLACEHOLDER_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])),
);

/**
 * TipTap custom Node extension for template placeholders.
 *
 * Renders as a colored badge in the editor.
 * Serializes to <span data-placeholder-key="key">{{key}}</span> in HTML.
 * Parses both the span format and legacy raw {{key}} text.
 */
export const TemplatePlaceholder = Node.create({
  name: 'templatePlaceholder',
  group: 'inline',
  inline: true,
  atom: true, // non-editable, selected as a whole

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-placeholder-key'),
        renderHTML: (attrs) => ({ 'data-placeholder-key': attrs.key }),
      },
      label: {
        default: null,
        parseHTML: (el) => {
          const key = el.getAttribute('data-placeholder-key');
          return key ? (PLACEHOLDER_MAP.get(key) ?? key) : null;
        },
        // label is only used in the editor view, not serialized
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-placeholder-key]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const key = HTMLAttributes['data-placeholder-key'] || '';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'template-placeholder',
      }),
      `{{${key}}}`,
    ];
  },

  renderText({ node }) {
    return `{{${node.attrs.key}}}`;
  },
});

/**
 * Preprocesses legacy HTML (from the old textarea editor) before loading into TipTap.
 * Converts raw {{key}} text into proper <span data-placeholder-key="key"> elements.
 */
export function preprocessLegacyHtml(html: string): string {
  if (!html) return html;
  return html.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    // Only convert known placeholders
    if (PLACEHOLDER_MAP.has(key)) {
      return `<span data-placeholder-key="${key}">{{${key}}}</span>`;
    }
    return _match;
  });
}
