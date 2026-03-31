import { useMemo } from 'react';
import { TEMPLATE_SAMPLE_DATA } from './template-sample-data';
import { PLACEHOLDER_MAP } from './placeholder-extension';

interface Props {
  html: string;
}

/**
 * Live preview panel that replaces placeholder nodes with sample data
 * and renders the result in an A4-styled container.
 */
export function TemplatePreview({ html }: Props) {
  const renderedHtml = useMemo(() => {
    if (!html) return '';

    let result = html;

    // 1. Replace <span data-placeholder-key="key">...</span> with sample data
    result = result.replace(
      /<span[^>]*data-placeholder-key="(\w+)"[^>]*>.*?<\/span>/g,
      (_match, key: string) => {
        return `<strong style="color: hsl(213 94% 35%)">${TEMPLATE_SAMPLE_DATA[key] ?? key}</strong>`;
      },
    );

    // 2. Also replace any leftover raw {{key}} (from legacy content)
    result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      if (PLACEHOLDER_MAP.has(key)) {
        return `<strong style="color: hsl(213 94% 35%)">${TEMPLATE_SAMPLE_DATA[key] ?? key}</strong>`;
      }
      return _match;
    });

    return result;
  }, [html]);

  return (
    <div className="h-full overflow-y-auto bg-muted/20 p-4">
      <div className="mx-auto bg-white dark:bg-zinc-900 shadow-md rounded-sm border max-w-[210mm] min-h-[297mm] p-10">
        {!html ? (
          <p className="text-muted-foreground text-sm text-center mt-20">
            Comece a editar o template para ver o preview aqui
          </p>
        ) : (
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}
      </div>
      {/* Legend */}
      <div className="mt-3 flex items-center gap-2 justify-center">
        <div className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-300" />
        <span className="text-[10px] text-muted-foreground">
          Campos em azul serao preenchidos com dados reais na geracao do documento
        </span>
      </div>
    </div>
  );
}
