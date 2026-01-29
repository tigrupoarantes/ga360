

# Plano: Usar SMTP Corporativo no Relatório de Auditoria

## Problema Identificado

A função `generate-stock-audit-report` está usando **Resend** para enviar e-mails, mas o projeto está configurado para usar **SMTP corporativo** (mail.grupoarantes.emp.br).

### Configuração Atual (system_settings)
```json
{
  "provider": "smtp",
  "host": "mail.grupoarantes.emp.br",
  "port": "465",
  "user": "ga360@grupoarantes.emp.br",
  "encryption": "tls"
}
```

---

## Solução

Modificar a edge function `generate-stock-audit-report` para:
1. **Buscar configurações** de email do `system_settings`
2. **Usar SMTP** diretamente (com a biblioteca denomailer, já usada em `send-email-smtp`)
3. **Remover dependência** do Resend

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/generate-stock-audit-report/index.ts` | Substituir Resend por SMTP |

---

## Detalhes da Implementação

### Antes (usando Resend)
```typescript
import { Resend } from "https://esm.sh/resend@4.0.0";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = new Resend(resendApiKey);

await resend.emails.send({
  from: "GA 360 <noreply@grupoarantes.com.br>",
  to: emailTo,
  subject: `[Auditoria Estoque] ${unitName} - ${auditDate}`,
  html: htmlReport,
});
```

### Depois (usando SMTP)
```typescript
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// Buscar config do banco
const { data: emailConfig } = await supabase
  .from("system_settings")
  .select("value")
  .eq("key", "email_config")
  .single();

const smtp = emailConfig?.value?.smtp;
const fromName = emailConfig?.value?.from_name || "GA 360";
const fromEmail = emailConfig?.value?.from_email || smtp?.user;

// Configurar cliente SMTP
const clientConfig = {
  connection: {
    hostname: smtp.host,
    port: parseInt(smtp.port),
    auth: { username: smtp.user, password: smtpPassword },
    tls: smtp.encryption === 'ssl' || smtp.port === '465',
  },
};

const client = new SMTPClient(clientConfig);
await client.send({
  from: `${fromName} <${fromEmail}>`,
  to: emailTo,
  subject: `[Auditoria Estoque] ${unitName} - ${auditDate}`,
  html: htmlReport,
});
await client.close();
```

---

## Tratamento de Senha SMTP

A senha SMTP precisa ser armazenada como secret no ambiente. Verificar se existe `SMTP_PASSWORD` configurado. Se não, solicitar ao usuário.

---

## Fluxo Atualizado

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  generate-stock-audit-report                                             │
│                                                                          │
│  1. Busca email_config do system_settings                               │
│  2. Obtém SMTP_PASSWORD das variáveis de ambiente                       │
│  3. Conecta via SMTP (mail.grupoarantes.emp.br:465)                     │
│  4. Envia e-mail com relatório HTML                                     │
│  5. Salva report_html e tracking no banco                               │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Nota sobre Porta 465

A porta 465 com "tls" na configuração indica SSL implícito. A conexão deve ser feita com `tls: true` desde o início (não STARTTLS).

---

## Verificação de Secret

Preciso confirmar se `SMTP_PASSWORD` está configurado nas secrets do projeto.

