# WhatsApp — como configurar

Guia para ligar as notificações de WhatsApp da RISE NOW pelo gateway da Pamaris
(`zap.pamaris.com.br`). O mesmo número também é usado pelo Clube do Empresário.

> **Nunca coloque chaves neste repositório.** Elas vão apenas nos _secrets_ do Lovable Cloud.

## 1. Cadastrar os secrets

No Lovable, abra o projeto → **Cloud** → **Secrets** e adicione um por um.
Outra opção é pedir no chat do Lovable: _"Adicione os secrets WHATSAPP_GATEWAY_URL,
WHATSAPP_GATEWAY_API_KEY, WHATSAPP_GATEWAY_SESSION_ID e CRON_SECRET"_. Ele abre um formulário
seguro para colar os valores.

| Nome                          | Valor                                                         |
| ----------------------------- | ------------------------------------------------------------- |
| `WHATSAPP_GATEWAY_URL`        | `https://zap.pamaris.com.br`                                  |
| `WHATSAPP_GATEWAY_API_KEY`    | a chave que começa com `owa_k1_` (enviada pela Pamaris)       |
| `WHATSAPP_GATEWAY_SESSION_ID` | o "ID da sessão" enviado pela Pamaris                         |
| `CRON_SECRET`                 | uma senha longa e aleatória criada por você (ver abaixo)      |
| `APP_BASE_URL`                | `https://board.mentoriarisenow.com.br` (se ainda não existir) |

Para gerar o `CRON_SECRET` no Windows (PowerShell):

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | % {[char]$_})
```

Guarde esse valor num gerenciador de senhas: ele é usado de novo no passo 4.

## 2. Publicar o código

Envie (push) os commits para a branch `main` do GitHub. O Lovable sincroniza sozinho e
publica as Edge Functions `rise-backend` e `rise-cron`.

## 3. Aplicar a atualização do banco

O Lovable **não** roda migrations sozinho. Peça no chat do Lovable:
_"Aplique a migration drizzle/migrations/0042_whatsapp_message_templates.sql"_, ou rode este
SQL no editor do banco:

```sql
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS message_templates jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.whatsapp_settings
  DROP CONSTRAINT IF EXISTS whatsapp_settings_message_templates_check;
ALTER TABLE public.whatsapp_settings
  ADD CONSTRAINT whatsapp_settings_message_templates_check
  CHECK (jsonb_typeof(message_templates) = 'object');
```

Sem esse passo tudo funciona, mas os textos não podem ser editados (usa os padrões).

## 4. Agendar os lembretes automáticos

Os lembretes de encontro, as etapas liberadas e o reenvio de mensagens na fila rodam pela
função `rise-cron`. Ela precisa ser chamada de tempos em tempos (sugestão: a cada 10 minutos).
No editor SQL do banco (com as extensões `pg_cron` e `pg_net` ativas), troque
`COLE_AQUI_O_CRON_SECRET` pelo valor do passo 1 e rode:

```sql
select vault.create_secret('COLE_AQUI_O_CRON_SECRET', 'rise_cron_secret');

select cron.schedule(
  'rise-whatsapp-notificacoes',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://riakceytqrlvdcgcwfdx.supabase.co/functions/v1/rise-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'rise_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
```

Para desligar depois: `select cron.unschedule('rise-whatsapp-notificacoes');`

## 5. Testar na plataforma

1. Entre como administradora → menu **WhatsApp**.
2. O status deve aparecer como **Conectado**, com o número institucional.
3. Em **Mensagem de teste**, envie para o seu próprio celular.
4. Em **Textos das mensagens**, ajuste cada aviso e clique em **Salvar textos**.
5. Em **Notificações automáticas**, ligue os avisos desejados e clique em **Salvar preferências**.

## Se algo der errado

| Sintoma no painel                       | O que fazer                                                |
| --------------------------------------- | ---------------------------------------------------------- |
| "WhatsApp ainda não configurado"        | Falta algum secret do passo 1 (confira os nomes exatos).   |
| "Chave do gateway de WhatsApp inválida" | A `WHATSAPP_GATEWAY_API_KEY` está errada ou foi revogada.  |
| "Gateway indisponível"                  | O gateway está fora do ar; fale com a Pamaris.             |
| "Aguardando leitura do QR Code"         | O celular desconectou: leia o QR Code de novo pelo painel. |
| Mensagens "Na fila" que não saem        | O número está desconectado ou o passo 4 não foi feito.     |

## Boas práticas

- O número é compartilhado com o Clube do Empresário: mantenha o nome **RISE NOW** nos textos.
- A plataforma envia uma mensagem por vez, com pausa de 3,5 s, só para quem tem conta ativa.
- Se a chave vazar, peça à Pamaris para revogá-la e cadastre a nova no passo 1.
