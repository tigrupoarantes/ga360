

# Plano: Migrar Todos os Arquivos para o Supabase Externo

## Resumo

Foram identificados **15 arquivos** que ainda estão usando o cliente do Lovable Cloud (`@/integrations/supabase/client`) e precisam ser migrados para o cliente externo (`@/integrations/supabase/external-client`).

---

## Arquivos a Migrar

| # | Arquivo | Linha | Módulo |
|---|---------|-------|--------|
| 1 | `src/hooks/useAvatarUpload.ts` | 2 | Upload de Avatar |
| 2 | `src/components/meetings/MeetingDashboard.tsx` | 4 | Dashboard de Reuniões |
| 3 | `src/components/meetings/MeetingParticipants.tsx` | 7 | Participantes de Reunião |
| 4 | `src/components/meetings/RealtimeTranscription.tsx` | 8 | Transcrição em Tempo Real |
| 5 | `src/components/meetings/RecordingUpload.tsx` | 6 | Upload de Gravação |
| 6 | `src/components/meetings/TranscriptionViewer.tsx` | 5 | Visualizador de Transcrição |
| 7 | `src/components/settings/EmailConfigSection.tsx` | 8 | Configuração de Email |
| 8 | `src/components/settings/OpenAIConfigSection.tsx` | 9 | Configuração OpenAI |
| 9 | `src/components/settings/WhatsAppConfigSection.tsx` | 9 | Configuração WhatsApp |
| 10 | `src/components/settings/InvitesList.tsx` | 6 | Lista de Convites |
| 11 | `src/components/settings/InviteFormDialog.tsx` | 9 | Formulário de Convites |
| 12 | `src/components/tasks/TaskFormDialog.tsx` | 36 | Formulário de Tarefas |
| 13 | `src/pages/AdminOrganization.tsx` | 7 | Estrutura Organizacional |
| 14 | `src/pages/MeetingExecution.tsx` | 23 | Execução de Reunião |
| 15 | `src/pages/ChangePassword.tsx` | 3 | Troca de Senha |

---

## Estatísticas do Projeto

| Métrica | Valor |
|---------|-------|
| Arquivos já migrados | 85 |
| Arquivos pendentes | 15 |
| Percentual concluído | 85% |

---

## Alterações Necessárias

Para cada arquivo, a alteração é a mesma:

**De:**
```typescript
import { supabase } from '@/integrations/supabase/client';
```

**Para:**
```typescript
import { supabase } from '@/integrations/supabase/external-client';
```

---

## Detalhes por Arquivo

### 1. `src/hooks/useAvatarUpload.ts`
- **Linha:** 2
- **Funcionalidade:** Upload de fotos de perfil para o bucket `avatars`
- **Impacto:** Avatares serão salvos no storage do Supabase externo

### 2. `src/components/meetings/MeetingDashboard.tsx`
- **Linha:** 4
- **Funcionalidade:** Dashboard com métricas e gráficos de reuniões
- **Impacto:** Dados do dashboard virão do banco externo

### 3. `src/components/meetings/MeetingParticipants.tsx`
- **Linha:** 7
- **Funcionalidade:** Gestão de participantes de reuniões
- **Impacto:** Lista de participantes e convites usarão banco externo

### 4. `src/components/meetings/RealtimeTranscription.tsx`
- **Linha:** 8
- **Funcionalidade:** Transcrição em tempo real com ElevenLabs
- **Impacto:** Transcrições serão salvas no banco externo

### 5. `src/components/meetings/RecordingUpload.tsx`
- **Linha:** 6
- **Funcionalidade:** Upload de gravações de reuniões
- **Impacto:** Arquivos de áudio serão salvos no storage externo

### 6. `src/components/meetings/TranscriptionViewer.tsx`
- **Linha:** 5
- **Funcionalidade:** Visualização e geração de ATAs
- **Impacto:** Transcrições e ATAs virão do banco externo

### 7. `src/components/settings/EmailConfigSection.tsx`
- **Linha:** 8
- **Funcionalidade:** Configurações de SMTP/Email
- **Impacto:** Configs de email serão salvas no banco externo

### 8. `src/components/settings/OpenAIConfigSection.tsx`
- **Linha:** 9
- **Funcionalidade:** Configurações de integração OpenAI
- **Impacto:** API keys e modelos serão salvos no banco externo

### 9. `src/components/settings/WhatsAppConfigSection.tsx`
- **Linha:** 9
- **Funcionalidade:** Configurações de WhatsApp (Twilio/Evolution)
- **Impacto:** Credenciais de WhatsApp serão salvas no banco externo

### 10. `src/components/settings/InvitesList.tsx`
- **Linha:** 6
- **Funcionalidade:** Lista de convites pendentes
- **Impacto:** Convites virão do banco externo

### 11. `src/components/settings/InviteFormDialog.tsx`
- **Linha:** 9
- **Funcionalidade:** Criação de novos convites
- **Impacto:** Convites serão criados no banco externo

### 12. `src/components/tasks/TaskFormDialog.tsx`
- **Linha:** 36
- **Funcionalidade:** Criação/edição de tarefas
- **Impacto:** Tarefas serão salvas no banco externo

### 13. `src/pages/AdminOrganization.tsx`
- **Linha:** 7
- **Funcionalidade:** Gestão de empresas e áreas (página atual)
- **Impacto:** Empresas e áreas virão do banco externo

### 14. `src/pages/MeetingExecution.tsx`
- **Linha:** 23
- **Funcionalidade:** Execução de reuniões em andamento
- **Impacto:** Dados da reunião virão do banco externo

### 15. `src/pages/ChangePassword.tsx`
- **Linha:** 3
- **Funcionalidade:** Troca de senha do usuário
- **Impacto:** Atualização de senha usará auth do banco externo

---

## Observação sobre Storage

Os arquivos que usam **Storage** (upload de avatars, gravações) precisam que os buckets correspondentes existam no Supabase externo:

- `avatars` - Para fotos de perfil
- Bucket para gravações de reuniões (se existir)

Verifique se esses buckets estão criados no seu Supabase externo.

---

## Ordem de Implementação Sugerida

1. **Primeiro:** Páginas principais (AdminOrganization, ChangePassword, MeetingExecution)
2. **Segundo:** Componentes de reuniões (MeetingDashboard, MeetingParticipants, etc.)
3. **Terceiro:** Configurações (Email, OpenAI, WhatsApp, Invites)
4. **Quarto:** Hook de avatar e TaskFormDialog

---

## Verificação Pós-Migração

Após migrar todos os arquivos, testar:

- [ ] Login e logout
- [ ] Troca de senha
- [ ] Upload de avatar no perfil
- [ ] Criação/edição de empresas e áreas
- [ ] Criação de reuniões e gestão de participantes
- [ ] Configurações de email/OpenAI/WhatsApp
- [ ] Criação de tarefas
- [ ] Envio de convites

