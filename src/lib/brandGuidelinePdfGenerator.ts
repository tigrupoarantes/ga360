import jsPDF from 'jspdf';

export async function generateBrandGuidelinePDF(): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Color definitions for visual representation
  const colors = {
    primary: { r: 139, g: 92, b: 246 }, // #8B5CF6
    accent: { r: 167, g: 139, b: 250 }, // #A78BFA
    cyan: { r: 6, g: 182, b: 212 }, // #06B6D4
    coral: { r: 251, g: 146, b: 60 }, // #FB923C
    navy: { r: 30, g: 64, b: 115 }, // #1E4073
    success: { r: 34, g: 197, b: 94 }, // #22C55E
    warning: { r: 245, g: 158, b: 11 }, // #F59E0B
    destructive: { r: 239, g: 68, b: 68 }, // #EF4444
    info: { r: 14, g: 165, b: 233 }, // #0EA5E9
    sidebar: { r: 35, g: 30, b: 51 }, // #231E33
  };

  // Helper functions
  const addHeader = (text: string, fontSize: number = 16) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text(text, margin, yPosition);
    yPosition += fontSize * 0.5 + 5;
    doc.setTextColor(0, 0, 0);
  };

  const addSubHeader = (text: string) => {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text(text, margin, yPosition);
    yPosition += 8;
    doc.setTextColor(0, 0, 0);
  };

  const addText = (text: string, fontSize: number = 10) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, margin, yPosition);
    yPosition += lines.length * fontSize * 0.35 + 3;
  };

  const addCodeBlock = (code: string) => {
    doc.setFillColor(245, 245, 245);
    const lines = code.split('\n');
    const blockHeight = lines.length * 4 + 8;
    doc.rect(margin, yPosition - 4, maxWidth, blockHeight, 'F');
    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    lines.forEach((line, index) => {
      doc.text(line, margin + 4, yPosition + (index * 4));
    });
    yPosition += blockHeight + 5;
    doc.setFont('helvetica', 'normal');
  };

  const addColorSwatch = (name: string, hsl: string, hex: string, color: { r: number; g: number; b: number }, usage: string) => {
    // Color rectangle
    doc.setFillColor(color.r, color.g, color.b);
    doc.rect(margin, yPosition - 4, 15, 10, 'F');
    
    // Text info
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(name, margin + 20, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(`HSL: ${hsl}`, margin + 20, yPosition + 4);
    doc.text(`HEX: ${hex}`, margin + 80, yPosition + 4);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(usage, margin + 20, yPosition + 8);
    doc.setTextColor(0, 0, 0);
    yPosition += 14;
  };

  const addTableRow = (col1: string, col2: string, col3: string, isHeader: boolean = false) => {
    const colWidths = [60, 50, maxWidth - 110];
    doc.setFontSize(9);
    doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
    if (isHeader) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, yPosition - 4, maxWidth, 8, 'F');
    }
    doc.text(col1, margin + 2, yPosition);
    doc.text(col2, margin + colWidths[0] + 2, yPosition);
    doc.text(col3, margin + colWidths[0] + colWidths[1] + 2, yPosition);
    yPosition += 7;
  };

  const checkPageBreak = (requiredSpace: number = 40) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  const addPageNumber = () => {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Página ${i} de ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
  };

  // ============================================
  // PAGE 1 - COVER
  // ============================================
  doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
  doc.rect(0, 0, pageWidth, 80, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Manual de Identidade Visual', pageWidth / 2, 35, { align: 'center' });
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.text('GA360 / CRESCER+', pageWidth / 2, 50, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(`Versão 1.0 • ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 65, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  yPosition = 100;
  
  addHeader('Sobre este Documento', 14);
  addText('Este manual contém todas as diretrizes de identidade visual do sistema GA360/CRESCER+. Ele serve como referência para manter consistência visual em todos os projetos e produtos relacionados.');
  yPosition += 10;
  
  addHeader('Conteúdo', 14);
  const contents = [
    '1. Paleta de Cores Principal',
    '2. Cores Personalizadas e Sidebar',
    '3. Dark Mode',
    '4. Tipografia',
    '5. Espaçamento e Layout',
    '6. Sombras e Transições',
    '7. Animações',
    '8. Glassmorphism',
    '9. Componentes UI',
    '10. Variáveis CSS Completas',
    '11. Dependências e Resumo'
  ];
  contents.forEach(item => {
    doc.setFontSize(10);
    doc.text(item, margin + 10, yPosition);
    yPosition += 6;
  });

  // ============================================
  // PAGE 2 - PRIMARY COLORS
  // ============================================
  doc.addPage();
  yPosition = margin;
  
  addHeader('1. Paleta de Cores Principal', 18);
  addText('As cores primárias formam a base da identidade visual. A cor principal violeta (#8B5CF6) representa inovação e modernidade.');
  yPosition += 10;
  
  addSubHeader('Cores Base');
  addColorSwatch('Background', '0 0% 100%', '#FFFFFF', { r: 255, g: 255, b: 255 }, 'Fundo principal da aplicação');
  addColorSwatch('Foreground', '240 10% 3.9%', '#0A0A0B', { r: 10, g: 10, b: 11 }, 'Texto principal');
  addColorSwatch('Primary', '257 85% 60%', '#8B5CF6', colors.primary, 'Botões, links, elementos de destaque');
  addColorSwatch('Primary Foreground', '0 0% 100%', '#FFFFFF', { r: 255, g: 255, b: 255 }, 'Texto sobre cor primária');
  addColorSwatch('Secondary', '240 4.8% 95.9%', '#F4F4F5', { r: 244, g: 244, b: 245 }, 'Fundos secundários');
  addColorSwatch('Accent', '256 91% 67%', '#A78BFA', colors.accent, 'Acentos, estados hover');
  
  yPosition += 10;
  addSubHeader('Cores de Status');
  addColorSwatch('Success', '142 76% 36%', '#22C55E', colors.success, 'Confirmações, sucesso');
  addColorSwatch('Warning', '38 92% 50%', '#F59E0B', colors.warning, 'Avisos, atenção');
  addColorSwatch('Destructive', '0 84.2% 60.2%', '#EF4444', colors.destructive, 'Erros, exclusões');
  addColorSwatch('Info', '199 89% 48%', '#0EA5E9', colors.info, 'Informações');

  // ============================================
  // PAGE 3 - CUSTOM COLORS & SIDEBAR
  // ============================================
  doc.addPage();
  yPosition = margin;
  
  addHeader('2. Cores Personalizadas e Sidebar', 18);
  
  addSubHeader('Cores Personalizadas');
  addColorSwatch('Cyan', '189 94% 43%', '#06B6D4', colors.cyan, 'Gráficos, destaques especiais');
  addColorSwatch('Coral', '16 100% 66%', '#FB923C', colors.coral, 'Alertas visuais, badges');
  addColorSwatch('Navy', '224 71% 30%', '#1E4073', colors.navy, 'Elementos de contraste');
  
  yPosition += 15;
  addSubHeader('Cores da Sidebar');
  addText('A sidebar possui um tema escuro independente para criar contraste com o conteúdo principal.');
  yPosition += 5;
  addColorSwatch('Sidebar Background', '252 28% 14%', '#231E33', colors.sidebar, 'Fundo escuro da sidebar');
  addColorSwatch('Sidebar Foreground', '0 0% 100%', '#FFFFFF', { r: 255, g: 255, b: 255 }, 'Texto na sidebar');
  addColorSwatch('Sidebar Accent', '257 85% 60%', '#8B5CF6', colors.primary, 'Itens ativos na sidebar');
  addColorSwatch('Sidebar Border', '252 28% 20%', '#3D3654', { r: 61, g: 54, b: 84 }, 'Bordas na sidebar');

  // ============================================
  // PAGE 4 - DARK MODE
  // ============================================
  doc.addPage();
  yPosition = margin;
  
  addHeader('3. Dark Mode', 18);
  addText('O sistema suporta modo escuro através de variáveis CSS. As cores são ajustadas automaticamente mantendo a hierarquia visual.');
  yPosition += 10;
  
  addSubHeader('Mapeamento de Cores');
  addTableRow('Variável', 'Light Mode', 'Dark Mode', true);
  addTableRow('--background', '0 0% 100%', '240 10% 3.9%');
  addTableRow('--foreground', '240 10% 3.9%', '0 0% 100%');
  addTableRow('--card', '0 0% 100%', '240 10% 7%');
  addTableRow('--primary', '257 85% 60%', '257 85% 65%');
  addTableRow('--secondary', '240 4.8% 95.9%', '240 5.9% 15%');
  addTableRow('--muted', '240 4.8% 95.9%', '240 5.9% 15%');
  addTableRow('--accent', '256 91% 67%', '256 91% 72%');
  addTableRow('--border', '240 5.9% 90%', '240 5.9% 20%');
  
  yPosition += 15;
  addSubHeader('Implementação CSS');
  addCodeBlock(`.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 100%;
  --card: 240 10% 7%;
  --primary: 257 85% 65%;
  --glass-bg: rgba(15, 15, 20, 0.85);
  --glass-border: rgba(255, 255, 255, 0.08);
}`);

  // ============================================
  // PAGE 5 - TYPOGRAPHY
  // ============================================
  doc.addPage();
  yPosition = margin;
  
  addHeader('4. Tipografia', 18);
  
  addSubHeader('Família de Fontes');
  addCodeBlock(`font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display",
  "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;`);
  
  addText('O sistema utiliza a fonte nativa do sistema operacional para melhor performance e consistência com a plataforma.');
  yPosition += 10;
  
  addSubHeader('Hierarquia de Textos');
  addTableRow('Elemento', 'Tailwind Class', 'Peso / Tracking', true);
  addTableRow('Heading 1', 'text-3xl', 'font-bold (700) / tight');
  addTableRow('Heading 2', 'text-2xl', 'font-semibold (600) / tight');
  addTableRow('Heading 3', 'text-lg', 'font-semibold (600) / tight');
  addTableRow('Body', 'text-sm', 'font-medium (500) / normal');
  addTableRow('Caption', 'text-xs', 'font-normal (400) / normal');
  
  yPosition += 15;
  addSubHeader('Estilos de Texto');
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Heading 1 - Dashboard', margin, yPosition);
  yPosition += 10;
  
  doc.setFontSize(18);
  doc.text('Heading 2 - Seção Principal', margin, yPosition);
  yPosition += 8;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Heading 3 - Subseção', margin, yPosition);
  yPosition += 7;
  
  doc.setFontSize(11);
  doc.text('Body Text - Texto principal do conteúdo', margin, yPosition);
  yPosition += 6;
  
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Caption - Informações secundárias', margin, yPosition);
  doc.setTextColor(0, 0, 0);

  // ============================================
  // PAGE 6 - SPACING & LAYOUT
  // ============================================
  doc.addPage();
  yPosition = margin;
  
  addHeader('5. Espaçamento e Layout', 18);
  
  addSubHeader('Border Radius');
  addCodeBlock(`--radius: 0.75rem; /* 12px - Padrão */

border-radius-lg: 0.75rem;
border-radius-md: calc(0.75rem - 2px);  /* 10px */
border-radius-sm: calc(0.75rem - 4px);  /* 8px */
border-radius-xl: 1rem;  /* 16px - Inputs especiais */`);
  
  addSubHeader('Container');
  addCodeBlock(`container: {
  center: true,
  padding: "2rem",
  screens: {
    "2xl": "1400px"
  }
}`);
  
  addSubHeader('Dimensões da Sidebar');
  addTableRow('Propriedade', 'Valor', 'Descrição', true);
  addTableRow('Largura', '256px (w-64)', 'Largura total da sidebar');
  addTableRow('Padding itens', 'px-3 py-2.5', 'Espaçamento interno dos itens');
  addTableRow('Gap ícones', '12px (gap-3)', 'Distância entre ícone e texto');
  addTableRow('Tamanho ícones', 'h-5 w-5', 'Ícones da navegação');
  
  yPosition += 15;
  addSubHeader('Espaçamentos Comuns');
  addTableRow('Uso', 'Tailwind', 'Pixels', true);
  addTableRow('Padding card', 'p-6', '24px');
  addTableRow('Gap elementos', 'gap-4', '16px');
  addTableRow('Margin seções', 'mb-8', '32px');
  addTableRow('Padding botões', 'px-4 py-2', '16px / 8px');

  // ============================================
  // PAGE 7 - SHADOWS & TRANSITIONS
  // ============================================
  doc.addPage();
  yPosition = margin;
  
  addHeader('6. Sombras e Transições', 18);
  
  addSubHeader('Sombras');
  addCodeBlock(`--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.03);

--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.05),
             0 2px 4px -1px rgba(0, 0, 0, 0.03);

--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.05),
             0 4px 6px -2px rgba(0, 0, 0, 0.02);

--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.05),
             0 10px 10px -5px rgba(0, 0, 0, 0.02);`);
  
  addSubHeader('Transições');
  addCodeBlock(`--transition-smooth: 0.32s cubic-bezier(0.4, 0, 0.2, 1);
--transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
--transition-spring: 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);`);
  
  addSubHeader('Uso das Transições');
  addTableRow('Classe', 'Duração', 'Uso Recomendado', true);
  addTableRow('.transition-smooth', '320ms', 'Animações principais, modais');
  addTableRow('.transition-fast', '150ms', 'Hover states, micro-interações');
  addTableRow('.transition-spring', '500ms', 'Animações com bounce');

  // ============================================
  // PAGE 8 - ANIMATIONS
  // ============================================
  doc.addPage();
  yPosition = margin;
  
  addHeader('7. Animações', 18);
  
  addSubHeader('Fade In');
  addCodeBlock(`@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
/* Classe: animate-fade-in */`);
  
  addSubHeader('Fade In Up');
  addCodeBlock(`@keyframes fade-in-up {
  from { 
    opacity: 0; 
    transform: translateY(16px); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
}
/* Classe: animate-fade-in-up */`);
  
  addSubHeader('Slide In Right');
  addCodeBlock(`@keyframes slide-in-right {
  from { 
    opacity: 0; 
    transform: translateX(16px); 
  }
  to { 
    opacity: 1; 
    transform: translateX(0); 
  }
}
/* Classe: animate-slide-in-right */`);
  
  checkPageBreak(60);
  addSubHeader('Float (para logos)');
  addCodeBlock(`@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}
/* Classe: animate-float */`);

  // ============================================
  // PAGE 9 - GLASSMORPHISM
  // ============================================
  doc.addPage();
  yPosition = margin;
  
  addHeader('8. Glassmorphism', 18);
  addText('O efeito glassmorphism (vidro fosco) é usado em cards e modais para criar profundidade visual.');
  yPosition += 10;
  
  addSubHeader('Light Mode');
  addCodeBlock(`--glass-bg: rgba(255, 255, 255, 0.8);
--glass-border: rgba(255, 255, 255, 0.5);

.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
}`);
  
  addSubHeader('Dark Mode');
  addCodeBlock(`--glass-bg: rgba(15, 15, 20, 0.85);
--glass-border: rgba(255, 255, 255, 0.08);`);
  
  addSubHeader('Auth Card (Exemplo Completo)');
  addCodeBlock(`.auth-card {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  padding: 2rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
}`);

  // ============================================
  // PAGE 10 - UI COMPONENTS
  // ============================================
  doc.addPage();
  yPosition = margin;
  
  addHeader('9. Componentes UI', 18);
  
  addSubHeader('Variantes de Botões');
  addTableRow('Variante', 'Classes', 'Uso', true);
  addTableRow('default', 'bg-primary text-primary-foreground', 'Ação principal');
  addTableRow('secondary', 'bg-secondary text-secondary-foreground', 'Ação secundária');
  addTableRow('outline', 'border border-input bg-background', 'Ação alternativa');
  addTableRow('ghost', 'hover:bg-accent', 'Ação sutil');
  addTableRow('destructive', 'bg-destructive text-destructive-foreground', 'Ações destrutivas');
  addTableRow('link', 'text-primary underline-offset-4', 'Links inline');
  
  yPosition += 10;
  addSubHeader('Tamanhos de Botões');
  addTableRow('Tamanho', 'Classes', 'Dimensões', true);
  addTableRow('default', 'h-10 px-4 py-2', '40px altura');
  addTableRow('sm', 'h-9 rounded-md px-3', '36px altura');
  addTableRow('lg', 'h-11 rounded-md px-8', '44px altura');
  addTableRow('icon', 'h-10 w-10', '40px quadrado');
  
  yPosition += 10;
  addSubHeader('Estilos de Cards');
  addCodeBlock(`/* Card Base */
.card {
  @apply rounded-lg border bg-card text-card-foreground shadow-sm;
}

/* Stats Card Variantes */
.stats-primary { @apply border-primary/20 bg-primary/5; }
.stats-secondary { @apply border-secondary/20 bg-secondary/5; }
.stats-accent { @apply border-accent/20 bg-accent/10; }`);
  
  checkPageBreak(50);
  addSubHeader('Estilos de Inputs');
  addCodeBlock(`input {
  @apply h-12 bg-secondary/30 border-0 rounded-xl
         focus-visible:ring-2 focus-visible:ring-primary/20;
}`);

  // ============================================
  // PAGE 11 - CSS VARIABLES
  // ============================================
  doc.addPage();
  yPosition = margin;
  
  addHeader('10. Variáveis CSS Completas', 18);
  
  addCodeBlock(`:root {
  /* Cores Base */
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;
  
  /* Cores Primárias */
  --primary: 257 85% 60%;
  --primary-foreground: 0 0% 100%;
  --primary-hover: 257 85% 55%;
  
  /* Cores Secundárias */
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 20%;
  --secondary-hover: 240 4.8% 92%;
  
  /* Cores de Acento */
  --accent: 256 91% 67%;
  --accent-foreground: 0 0% 100%;
  --accent-hover: 256 91% 62%;
  
  /* Cores Auxiliares */
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 50%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 100%;
  --success: 142 76% 36%;
  --warning: 38 92% 50%;
  --info: 199 89% 48%;`);

  doc.addPage();
  yPosition = margin;
  
  addCodeBlock(`  /* Bordas e Inputs */
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 257 85% 60%;
  
  /* Dimensões */
  --radius: 0.75rem;
  
  /* Cores Personalizadas */
  --cyan: 189 94% 43%;
  --coral: 16 100% 66%;
  --navy: 224 71% 30%;
  
  /* Sidebar */
  --sidebar-background: 252 28% 14%;
  --sidebar-foreground: 0 0% 100%;
  --sidebar-primary: 257 85% 60%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 257 85% 60%;
  --sidebar-accent-foreground: 0 0% 100%;
  --sidebar-border: 252 28% 20%;
  --sidebar-ring: 257 85% 60%;
  
  /* Transições */
  --transition-smooth: 0.32s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-spring: 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  
  /* Sombras */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
  
  /* Glassmorphism */
  --glass-bg: rgba(255, 255, 255, 0.8);
  --glass-border: rgba(255, 255, 255, 0.5);
}`);

  // ============================================
  // PAGE 12 - DEPENDENCIES & SUMMARY
  // ============================================
  doc.addPage();
  yPosition = margin;
  
  addHeader('11. Dependências e Resumo', 18);
  
  addSubHeader('Pacotes Necessários');
  addCodeBlock(`{
  "@radix-ui/react-*": "Componentes UI base",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.6.0",
  "tailwindcss-animate": "^1.0.7",
  "lucide-react": "^0.462.0",
  "next-themes": "^0.3.0"
}`);
  
  yPosition += 10;
  addSubHeader('Resumo do Design System');
  
  const summaryData = [
    ['Estilo Geral', 'Apple-inspired, minimalista, clean'],
    ['Cor Principal', 'Violeta (#8B5CF6)'],
    ['Bordas', 'Arredondadas (12px padrão)'],
    ['Efeitos', 'Glassmorphism, sombras suaves'],
    ['Animações', 'Fade-in, slide, hover suaves'],
    ['Modo Escuro', 'Suportado com variáveis CSS'],
    ['Responsivo', 'Grid flexível, breakpoints Tailwind'],
    ['Ícones', 'Lucide React (h-5 w-5 padrão)'],
  ];
  
  summaryData.forEach(([key, value]) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${key}:`, margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 45, yPosition);
    yPosition += 7;
  });
  
  yPosition += 15;
  addSubHeader('Logos e Assets');
  addTableRow('Arquivo', 'Uso', 'Dimensão', true);
  addTableRow('logo-crescer-badge.png', 'Login, splashscreen', 'h-40 (160px)');
  addTableRow('logo-crescer-icon.png', 'Sidebar, favicon', 'h-10 (40px)');
  addTableRow('logo-crescer-rocket.png', 'Elementos promocionais', 'Variável');
  
  // Add page numbers
  addPageNumber();

  // Save the PDF
  const fileName = `GA360_Identidade_Visual_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
