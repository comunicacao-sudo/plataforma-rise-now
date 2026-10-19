# WAHA da RISE NOW

Esta pasta prepara uma instância única do WAHA Core para notificações transacionais da RISE NOW. A imagem usa o motor GOWS, a sessão institucional tem o nome fixo `rise-principal` e o volume `rise-now-waha-sessions` preserva o vínculo do WhatsApp entre reinícios.

## Requisitos

- VPS Linux com Docker Engine e Docker Compose v2;
- um número institucional dedicado à RISE NOW;
- domínio HTTPS para o endpoint utilizado pelo backend;
- firewall, proxy reverso e, quando possível, VPN ou lista de IPs permitidos.

O WAHA recomenda não expor sua API diretamente em redes públicas. Por isso, o Compose publica a porta somente em `127.0.0.1`. O acesso externo deve passar por um proxy reverso com TLS, limite de requisições e restrição de origem. Não publique a porta `3000` em `0.0.0.0`.

## 1. Criar os segredos

Gere uma chave aleatória e mantenha duas representações:

- a chave em texto puro, armazenada apenas no gerenciador de segredos do backend da RISE NOW como `WAHA_API_KEY`;
- o hash SHA-512 dessa chave, configurado no host do WAHA como `WAHA_API_KEY_HASH=sha512:<hash-hexadecimal>`.

Também gere credenciais distintas e fortes para o Dashboard e o Swagger. Nunca use os valores de exemplo em produção.

Crie um arquivo de ambiente privado fora do repositório, por exemplo `/etc/rise-now/waha.env`, tomando `.env.example` como referência. Proteja-o com permissões restritas ao usuário que executa o Docker.

## 2. Iniciar o serviço

Na raiz do repositório, execute no VPS:

```bash
docker compose \
  --env-file /etc/rise-now/waha.env \
  -f infra/waha/docker-compose.yml \
  pull

docker compose \
  --env-file /etc/rise-now/waha.env \
  -f infra/waha/docker-compose.yml \
  up -d
```

Confira o estado sem imprimir segredos:

```bash
docker compose -f infra/waha/docker-compose.yml ps
docker logs --tail 100 rise-now-waha
```

O QR não é impresso nos logs. A conexão do número deve ser feita pelo painel administrativo da RISE NOW, que consulta o QR no backend e nunca entrega a chave da API ao navegador.

## 3. Configurar a borda de rede

Configure Nginx, Caddy ou outro proxy confiável com estas regras mínimas:

1. certificado TLS válido e redirecionamento obrigatório para HTTPS;
2. upstream local `http://127.0.0.1:3000`;
3. firewall bloqueando acesso externo direto à porta `3000`;
4. acesso por VPN ou allowlist do backend sempre que a infraestrutura permitir;
5. limites de requisições, tamanho de corpo e tempo de conexão;
6. logs sem cabeçalhos sensíveis, especialmente `X-Api-Key`;
7. Dashboard e Swagger restritos à rede administrativa, não ao público.

Mesmo atrás do proxy, toda chamada da aplicação deve incluir `X-Api-Key`. Não coloque a chave em query strings, código cliente, logs ou URLs.

## 4. Variáveis do backend da RISE NOW

Configure estas variáveis no gerenciador de segredos do ambiente que executa a aplicação:

```dotenv
WAHA_BASE_URL=https://whatsapp.example.com
WAHA_API_KEY=<chave-em-texto-puro-correspondente-ao-hash>
WAHA_SESSION_NAME=rise-principal
WAHA_WEBHOOK_HMAC_KEY=<mesmo-segredo-configurado-no-host-do-WAHA>
APP_BASE_URL=https://mentoriarisenow.lovable.app
LOVABLE_CRON_SECRET=<segredo-aleatorio-para-o-processo-de-lembretes>
```

`WAHA_API_KEY` é segredo exclusivo do servidor. Variáveis públicas ou prefixadas para o frontend não devem ser usadas.

No arquivo privado do host do WAHA, configure também
`RISE_WEBHOOK_URL=https://mentoriarisenow.lovable.app/api/webhooks/waha` e o mesmo
`WAHA_WEBHOOK_HMAC_KEY`. Somente eventos `message.ack` são enviados; a aplicação valida a
assinatura HMAC antes de atualizar os estados entregue e lida.

## 5. Parear e operar a sessão

Depois do primeiro `up`, use **Administração > WhatsApp** na plataforma para criar/iniciar `rise-principal`, abrir o QR e parear o número institucional. O motor deve aparecer como `GOWS`. A configuração reinicia a sessão conhecida após reinícios do contêiner, mas não cria sessões adicionais.

Faça backup periódico do volume `rise-now-waha-sessions`. Para atualizar o WAHA:

```bash
docker compose \
  --env-file /etc/rise-now/waha.env \
  -f infra/waha/docker-compose.yml \
  pull

docker compose \
  --env-file /etc/rise-now/waha.env \
  -f infra/waha/docker-compose.yml \
  up -d
```

Após cada atualização, confirme no painel que a sessão está `WORKING` e envie apenas a mensagem de teste administrativa antes de liberar notificações reais.

## 6. Recuperação

- `STOPPED`: reinicie a sessão pelo painel da RISE NOW;
- `SCAN_QR_CODE`: faça novo pareamento pelo QR;
- falha após troca de VPS: restaure o volume antes de tentar novo pareamento;
- suspeita de vazamento: troque a chave em texto puro no backend e o hash no host do WAHA, depois reinicie o contêiner;
- desconexão intencional: use a ação de logout no painel e confirme que o telefone deixou de constar em dispositivos conectados.

Não apague o volume em uma rotina de atualização. A remoção do volume invalida a sessão e exige novo QR.
