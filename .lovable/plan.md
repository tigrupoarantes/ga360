

## Plano: Reescrever send-invite com SMTP nativo (sem bibliotecas externas)

### Problema
As bibliotecas `denomailer` e `nodemailer` são incompatíveis com o Supabase Edge Runtime, causando erros (`NaN`, crashes, connection closed). Enquanto isso, a funcao `test-smtp-connection` funciona perfeitamente porque usa conexoes TCP/TLS nativas do Deno.

### Solucao
Reescrever a funcao `send-invite` para usar a mesma abordagem da `test-smtp-connection` -- conexao TCP/TLS nativa do Deno com comandos SMTP manuais. Sem dependencias externas.

### O que muda

**Arquivo:** `supabase/functions/send-invite/index.ts`

- Remover import do `nodemailer`
- Implementar envio SMTP usando `Deno.connectTls` (SSL/465) ou `Deno.connect` (TLS/587)
- Conversa SMTP completa: EHLO -> AUTH LOGIN -> MAIL FROM -> RCPT TO -> DATA -> QUIT
- Manter `EdgeRuntime.waitUntil()` para processamento em background
- Logs detalhados de cada etapa SMTP para facilitar debug

### Fluxo SMTP implementado

```text
+-------------------+     +-------------------+
| Edge Function     |     | SMTP Server       |
|                   |     | (mail.grupo...)   |
| 1. Conecta SSL    |---->| 220 OK            |
| 2. EHLO localhost |---->| 250 OK            |
| 3. AUTH LOGIN     |---->| 334 Username       |
| 4. Base64(user)   |---->| 334 Password       |
| 5. Base64(pass)   |---->| 235 Auth OK        |
| 6. MAIL FROM:<>   |---->| 250 OK            |
| 7. RCPT TO:<>     |---->| 250 OK            |
| 8. DATA           |---->| 354 Start          |
| 9. Headers+Body   |---->| 250 OK (queued)   |
| 10. QUIT          |---->| 221 Bye            |
+-------------------+     +-------------------+
```

### Detalhes tecnicos

A funcao construira manualmente os headers do email (From, To, Subject, MIME-Version, Content-Type) e enviara o corpo HTML via o comando DATA do protocolo SMTP. A autenticacao sera feita via AUTH LOGIN com credenciais codificadas em Base64.

Esta abordagem elimina todas as dependencias externas e usa apenas APIs nativas do Deno que ja foram testadas e comprovadas com o servidor `mail.grupoarantes.emp.br` pela funcao `test-smtp-connection`.

### Apos o deploy

Voce precisara copiar o novo codigo e fazer deploy manualmente no Supabase externo (zveqhxaiwghexfobjaek), da mesma forma que fez anteriormente.

