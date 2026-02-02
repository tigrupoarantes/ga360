
# Plano: Corrigir Fluxo de Alteração de Senha para Novos Usuários

## Problema Identificado

O usuário **Pedro Henrique** (e qualquer novo usuário) não consegue alterar a senha porque:

1. O email de boas-vindas contém um link de **recovery/magiclink** que redireciona para `/change-password`
2. A rota `/change-password` está **protegida por `ProtectedRoute`**
3. O `ProtectedRoute` verifica se há sessão **antes** do token ser processado
4. Como não há sessão, o usuário é **redirecionado para `/auth`** imediatamente
5. O token na URL é perdido e a sessão nunca é estabelecida

**Evidência nos logs:**
```
token signature is invalid: signing method ES256 is invalid
403: invalid JWT: unable to parse or verify signature
```

---

## Solução Proposta

### Opção Escolhida: Remover ProtectedRoute da rota `/change-password`

A página de alteração de senha precisa estar **fora** do `ProtectedRoute` para permitir que o token seja processado corretamente.

---

## Alterações Necessárias

### Arquivo 1: `src/App.tsx`

Mover a rota `/change-password` para fora do `ProtectedRoute`:

```typescript
// DE (linha 293-299):
<Route
  path="/change-password"
  element={
    <ProtectedRoute>
      <ChangePassword />
    </ProtectedRoute>
  }
/>

// PARA:
<Route path="/change-password" element={<ChangePassword />} />
```

---

### Arquivo 2: `src/pages/ChangePassword.tsx`

Modificar a página para:
1. Processar o token da URL automaticamente ao carregar
2. Verificar se há sessão antes de permitir alteração
3. Redirecionar para `/auth` se não houver sessão após processar o token

**Alterações principais:**

```typescript
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/external-client';
// ... outros imports

export default function ChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  // ... outros estados

  // Processar token da URL e estabelecer sessão
  useEffect(() => {
    const processTokenFromUrl = async () => {
      setSessionLoading(true);
      
      // Verificar se há hash com token na URL
      const hash = location.hash;
      if (hash && hash.includes('access_token')) {
        console.log('Token encontrado na URL, processando...');
        
        // O Supabase processa automaticamente o hash
        // Aguardar um momento para a sessão ser estabelecida
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Verificar sessão atual
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Erro ao verificar sessão:', error);
        toast({
          title: 'Erro de autenticação',
          description: 'Seu link expirou ou é inválido. Solicite um novo.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }
      
      if (session) {
        setHasSession(true);
      } else {
        toast({
          title: 'Sessão não encontrada',
          description: 'Por favor, faça login ou solicite um novo link.',
          variant: 'destructive',
        });
        navigate('/auth');
      }
      
      setSessionLoading(false);
    };

    processTokenFromUrl();
  }, [location, navigate, toast]);

  // Se ainda está carregando a sessão, mostrar loading
  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se não tem sessão, não renderizar (já foi redirecionado)
  if (!hasSession) {
    return null;
  }

  // ... resto do componente (formulário)
}
```

---

## Fluxo Corrigido

```text
Email de Boas-Vindas
       ↓
Clique no Link (com token)
       ↓
/change-password#access_token=xxx
       ↓
ChangePassword.tsx processa token
       ↓
Supabase troca token por sessão
       ↓
Usuário define nova senha
       ↓
supabase.auth.updateUser() funciona!
       ↓
Sucesso → Redireciona para /profile
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Remover `ProtectedRoute` da rota `/change-password` |
| `src/pages/ChangePassword.tsx` | Adicionar lógica para processar token da URL e verificar sessão |

---

## Verificação Pós-Implementação

1. Criar um novo usuário de teste
2. Verificar se o email chega com o link correto
3. Clicar no link e confirmar que a página carrega
4. Alterar a senha com sucesso
5. Fazer login com a nova senha

---

## Nota Técnica

O erro **"signing method ES256 is invalid"** nos logs indica que o token ES256 do Supabase externo está sendo validado corretamente, mas a sessão não está sendo estabelecida porque o `ProtectedRoute` redireciona antes do processamento. Com esta correção, o fluxo será:

1. Página carrega sem `ProtectedRoute`
2. Token é processado pelo Supabase SDK
3. Sessão é estabelecida
4. Usuário altera senha com sucesso
