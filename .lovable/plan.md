
# Plano: Layout Full-Width (Tela Inteira)

## Problema Atual
O conteudo esta limitado a `max-w-6xl` (1152px) centralizado pela classe `container-apple`, deixando margens laterais vazias em telas maiores.

## Solucao
Alterar a classe `container-apple` e ajustar os containers para que o conteudo ocupe toda a largura disponivel, mantendo apenas um padding lateral confortavel.

## Alteracoes

### 1. `src/index.css` - Classe `container-apple`
Trocar `max-w-6xl` por `max-w-full` para remover o limite de largura:
```css
.container-apple {
  @apply max-w-full mx-auto px-6;
}
```
Isso afeta automaticamente todos os locais que usam essa classe: AppleNav, MainLayout (barra de empresa e conteudo principal), e menu mobile.

### 2. `tailwind.config.ts` - Container padrao
Aumentar o limite do container padrao do Tailwind de `1400px` para `100%`:
```ts
container: {
  center: true,
  padding: "2rem",
  screens: {
    "2xl": "100%",
  },
},
```

## Impacto
- **AppleNav**: navegacao ocupara toda a largura
- **Barra de empresa**: seletor se estendera ate as bordas
- **Conteudo principal**: todas as paginas (Dashboard, Admin, Reunioes, etc.) ocuparao a tela inteira
- **Padding lateral de 24px (px-6)** sera mantido para nao colar o conteudo nas bordas

## Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/index.css` | `max-w-6xl` para `max-w-full` na classe `container-apple` |
| `tailwind.config.ts` | Container `2xl` de `1400px` para `100%` |
