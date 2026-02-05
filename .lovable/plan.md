
# Plano: Remover Logo e Texto do Menu Principal

## Objetivo
Remover completamente a imagem do logo e o texto "CRESCER+" do menu de navegação, deixando apenas os itens de menu.

---

## Mudanças no Arquivo

### src/components/layout/AppleNav.tsx

**1. Remover imports não utilizados:**
- Linha 23: Remover `Rocket` do import de lucide-react
- Linha 40: Remover import do `logoIcon`

**2. Remover seção do Logo (linhas 113-124):**
Remover completamente o bloco:
```tsx
{/* Logo */}
<NavLink 
  to="/dashboard" 
  className="flex items-center gap-2 transition-smooth hover:opacity-70"
>
  <img ... />
  <span className="font-semibold text-lg hidden sm:block">CRESCER+</span>
</NavLink>
```

---

## Estrutura Final do Header

O header ficará com:
- Navegação desktop centralizada/à esquerda (itens de menu)
- Seção direita (busca, tema, usuário, menu mobile)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard  Reuniões  Processos  ...      🔍 🌙 👤 ☰           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

- Menu limpo sem logo ou texto de marca
- Visual minimalista focado na navegação
- Mantém glassmorphism e estética Apple-inspired
