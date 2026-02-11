

## Corrigir email chegando em branco

### Problema identificado

O email chega vazio porque o codigo atual tem dois bugs na construcao da mensagem MIME:

1. **`.filter(Boolean)` remove linhas vazias (`''`) que sao obrigatorias no protocolo MIME.** As linhas em branco separam headers de conteudo. Sem elas, o cliente de email nao consegue interpretar o corpo da mensagem.

2. **O conteudo Base64 e enviado em uma unica linha gigante.** O padrao RFC 2045 exige que linhas Base64 tenham no maximo 76 caracteres. Muitos servidores e clientes de email descartam ou corrompem linhas maiores que isso.

### Solucao

**Arquivo:** `supabase/functions/send-invite/index.ts`

Duas alteracoes:

1. **Remover `.filter(Boolean)`** da construcao da mensagem para preservar as linhas vazias obrigatorias do MIME.

2. **Adicionar funcao para quebrar Base64 em linhas de 76 caracteres:**

```text
// Antes (linha unica gigante):
"SGVsbG8gV29ybGQhIFRoaXMgaXMgYSB2ZXJ5IGxvbmcgc3RyaW5nLi4u..."

// Depois (quebrado a cada 76 chars):
"SGVsbG8gV29ybGQhIFRoaXMg\r\n"
"aXMgYSB2ZXJ5IGxvbmcgc3Ry\r\n"
"aW5nLi4u..."
```

### Detalhes tecnicos

- Criar helper `chunkBase64(str, size=76)` que quebra a string base64 em linhas
- Substituir `.filter(Boolean).join('\r\n')` por `.join('\r\n')` para manter separadores MIME
- Remover a linha `replyTo ? ... : ''` condicional e tratar separadamente para nao introduzir linhas vazias indevidas nos headers

Apos a alteracao, voce precisara copiar o novo codigo e fazer deploy no Supabase externo novamente.

