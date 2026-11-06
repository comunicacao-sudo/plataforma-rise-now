# Auditoria RISE NOW — segunda revisão de 05/11/2026

## Resultado e escopo

A plataforma tem pendências de confiabilidade e de controle de acesso. Os 75 testes automatizados passam, mas duas simulações adicionais reproduziram falhas do processamento de WhatsApp. Não há evidência, nesta auditoria, de mensagens duplicadas ou de exposição efetiva de dados em produção.

Referência: commit `17d6ff5c0d763cecfae46aea8ce735976c5c9b2a`, sincronizado entre checkout, GitHub e Lovable. Banco oficial: `riakceytqrlvdcgcwfdx`. Foram examinados código, políticas e permissões do banco, tarefas agendadas, respostas recentes do cron, dependências e cabeçalhos públicos do site. Não foram aplicadas correções funcionais, publicados novos serviços, enviados WhatsApps reais nem gerados novos diagnósticos de IA.

Este é um exame técnico com limites descritos abaixo; não é certificação de segurança nem teste de invasão completo.

## Prioridade 1 — corrigir primeiro

### 1. Execuções concorrentes podem enviar a mesma mensagem duas vezes

**Reproduzido em simulação local, sem rede.** Em `supabase/functions/_shared/whatsapp-gateway.ts:157`, a tentativa de reservar o envio altera `error_message`, mantendo a notificação como `pending`. Uma segunda execução pode reservar a mesma notificação enquanto a primeira aguarda o gateway. A proteção por atualização otimista não impede essa sequência.

Evidência da simulação: `mesmaNotificacaoEnviadaVezes: 2`. O cron e o envio acionado pelo painel compartilham esse caminho. Implementar reserva atômica com estado de processamento e prazo de recuperação, além de idempotência no gateway quando suportada. Verificar concorrência e falha após a entrega, antes da confirmação no banco.

### 2. Falhas podem avançar o cursor e fazer avisos deixarem de ser recuperados

**Reproduzido em simulação local.** Em `supabase/functions/rise-cron/automations.ts:59`, `last_run_at` é atualizado mesmo quando a automação lança erro. Algumas consultas também não verificam o campo `error` retornado pelo banco.

Evidência: `marcouExecucaoMesmoComFalha: true`. A sobreposição de dez minutos reduz alguns efeitos, mas não garante recuperação de falhas prolongadas; existe também limite de retrospectiva de seis horas. Avançar o cursor apenas após processamento bem-sucedido, tratar erros de consultas e permitir recuperação controlada por evento. HTTP 200 do cron não comprova sucesso de cada automação.

### 3. Lembretes pendentes podem sair depois do encontro ou após cancelamento

**Confirmado por inspeção do caminho de entrega; sem ocorrência demonstrada em produção.** `supabase/functions/rise-cron/index.ts:255` expira mensagens por idade de criação, com janela de 24 horas. Antes de enviar, não revalida horário e cancelamento do encontro ou reserva, nem a configuração atual da automação.

Uma indisponibilidade do gateway pode resultar em lembretes fora de contexto quando o serviço voltar. Definir validade por tipo de aviso e revalidar o evento de origem na entrega; cancelar itens vinculados quando o encontro for cancelado ou quando essa for a intenção ao desligar a automação.

### 4. Agendamento e cancelamento 1:1 podem deixar registros inconsistentes

**Confirmado por inspeção das compensações; sem criar reservas reais.** No fluxo de agendamento em `supabase/functions/rise-backend/index.ts:3163`, se a confirmação final da reserva falhar depois de criar a linha de encontro, a compensação remove o evento Google e a reserva, mas não remove a linha de encontro já criada.

Em `supabase/functions/rise-backend/index.ts:3255`, o cancelamento não verifica todos os erros de atualização e exclusão. Pode existir sucesso aparente ou cancelamento parcial. Validar cada escrita, tornar as operações repetíveis com segurança e reconciliar banco e Google Agenda após falhas.

### 5. A permissão de materiais de aula é mais ampla que a elegibilidade da aula

**Regra confirmada no banco oficial.** A política SELECT de `lesson_materials` libera registros com `lesson_id IS NOT NULL`, sem aplicar a elegibilidade da aula. A política correspondente de `storage.objects` repete esse critério para materiais vinculados a aulas.

A regra permite a leitura por usuário autenticado sem verificar a autorização específica daquela aula. Em uma transação de leitura simulando mentorado, havia um material de aula visível. Não foi comprovado acesso a material efetivamente restrito de outra turma ou mês: o problema confirmado é a ausência dessa verificação na política.

Reutilizar a regra de acesso da aula, turma e matrícula tanto na tabela quanto no Storage. Testar acesso autorizado e negado com usuários de turmas e meses diferentes.

## Prioridade 2 — resolver na sequência

### 6. O caderno ainda pode perder a última edição em navegação interna

**Confirmado por inspeção.** `src/components/rise-trail.tsx:282` salva com atraso de um segundo. O cleanup do efeito cancela o temporizador ao desmontar o componente. O aviso `beforeunload`, na linha 378, cobre saída ou recarga da janela, mas não a troca rápida de tela pelo menu da plataforma.

A correção anterior de erros visíveis e nova tentativa permanece útil, mas não resolve essa sequência. Preservar rascunho e garantir salvamento ou confirmação ao navegar. Validar digitando e trocando de tela antes de um segundo, incluindo falha de rede.

### 7. Avisos de vagas 1:1 não confirmam que existe horário livre

**Confirmado por inspeção.** `supabase/functions/rise-cron/automations.ts:380` usa oferta ativa e sua data de atualização como sinal de disponibilidade. Não confirma horários válidos, reservas existentes ou disponibilidade efetiva no Google Agenda antes de avisar. Uma edição pode disparar um aviso sem vaga; a chave diária também pode suprimir um novo aviso de reabertura no mesmo dia.

Basear o aviso na transição de nenhuma vaga para alguma vaga realmente reservável.

### 8. Avisos no grupo não filtram a turma destinatária de cada encontro

**Limitação confirmada no código, sem impacto atual demonstrado.** Cronograma semanal e avisos coletivos usam o grupo global e não cruzam integralmente o público do encontro com o público do grupo. Existem duas turmas, mas os cinco encontros coletivos atuais têm público `all`; não foi encontrado encontro restrito afetado.

Aplicar a elegibilidade antes de montar mensagens ou configurar grupos por turma antes de cadastrar encontros restritos.

### 9. Dependências têm alertas públicos que precisam de atualização e análise de alcance

Consulta ao registro público npm, conferida contra as versões do `bun.lock` por intervalo semântico, encontrou alertas aplicáveis em 11 nomes de pacotes: `brace-expansion`, `esbuild`, `js-yaml`, `launch-editor`, `minimatch`, `nanoid`, `seroval`, `shell-quote`, `source-map-js`, `vite` e `zod`.

Há um alerta upstream crítico de `shell-quote` 1.10.0, relacionado a uma sequência específica de uso de `quote()`. Isso não demonstra uma vulnerabilidade crítica explorável pela internet na plataforma. Parte dos pacotes pertence às ferramentas de desenvolvimento e construção; outros podem participar do runtime. A cadeia e a possibilidade de entrada controlada por usuário precisam ser analisadas antes de atribuir gravidade ao produto.

Fontes para triagem: [shell-quote](https://github.com/advisories/GHSA-pqg4-j6r4-53mv), [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [Seroval](https://github.com/advisories/GHSA-f86p-h4j2-7qgj), [Vite/launch-editor](https://github.com/advisories/GHSA-587h-7wmj-h5pm). Atualizar com lockfile e executar regressão, sem aplicar atualizações principais indiscriminadamente.

### 10. Proteção contra senhas vazadas está desligada

**Confirmado pelo advisor de segurança do Supabase.** Ativar a proteção se disponível no plano e validar os fluxos de definição e troca de senha. Referência: [documentação do Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

### 11. Ferramentas de migração não bloqueiam alvo incorreto

`drizzle.config.ts` ainda depende de `LOVABLE_DB_MIGRATION_URL`. O script `scripts/verify-supabase-target.mjs` emite aviso para configurações divergentes em vez de impedir a operação. O frontend atual usa o Supabase oficial, mas uma migração futura pode atingir o banco errado. Exigir identificação do projeto esperado e falhar antes de operações de escrita com alvo divergente.

## Melhorias e verificações complementares

- **Cabeçalhos:** HEAD do site retornou 200, com HSTS, `nosniff` e política de referência. Não retornou CSP nem `X-Frame-Options`. Planejar CSP compatível com a aplicação e proteção de enquadramento; essa ausência isolada não prova exploração.
- **Revogação de privilégios:** `public.has_role` confere o estado aprovado da conta, enquanto `private.is_admin` consulta os papéis diretamente. Uniformizar e testar sessões já abertas após revogação. Não foi demonstrado acesso indevido de conta revogada.
- **IA:** faltam cotas e limites claros para novas tentativas e recuperações. Não foi gerado diagnóstico real nesta revisão. Não há fundamento para tratar a combinação `background: true` e `store: false` como necessariamente inválida.
- **Uploads:** o bucket público de avatares tem limite e tipos de imagem configurados. Buckets privados de materiais e conteúdo não têm limites equivalentes no próprio bucket; avaliar limites por uso.
- **Cobertura:** há CI em push/PR para main, com build, tipos, testes e lint. Parte dos testes verifica padrões no código e não executa cenários reais de concorrência, falhas de rede ou interface. Acrescentar testes dos problemas reproduzidos e de compensação de agendamentos.

## Correções anteriores e estado de produção verificados

- Permissões e histórico de autorização do WhatsApp continuam restritos ao servidor, sem grants de leitura para navegador. Os avisos de RLS sem políticas nessas tabelas refletem essa escolha; não indicam exposição.
- RPCs de autorização, conclusão automática e atualização dos meses permanecem restritas ao `service_role`.
- Não foi encontrada tabela no schema public com RLS desligado.
- A simulação de leitura como mentorado retornou zero notas privadas de terceiros e zero históricos de autorização de WhatsApp visíveis.
- Diretório da mentora Gabriela corrigido; sete matrículas ativas no mês 1, com próxima virada prevista para 16/11/2026.
- Painel de contatos recolhível já publicado e sincronizado com o commit auditado.
- Cinco pessoas com autorização ativa, dez automações ligadas e grupo configurado.
- Cron ativo a cada cinco minutos. As oito execuções recentes examinadas terminaram com sucesso e HTTP 200, gateway `ready`, sem mensagens enfileiradas ou entregues nessas respostas.
- A tabela de notificações WhatsApp estava vazia. Portanto, não existe histórico de entrega automática nessa tabela para comprovar o ciclo completo em produção.
- O aviso coletivo configurado para 15 minutos é uma preferência atual, não um defeito por diferir do pedido inicial de duas horas.

## Validação e limites

Nesta revisão: 75 testes passaram, zero falhas; orçamento total JS/CSS de 317.115 bytes gzip, abaixo de 900.000; entrada pública de 114.763 bytes gzip, abaixo de 120.000. Build, checagem de tipos e lint haviam passado na mesma revisão de código na etapa anterior. Duas simulações extras reproduziram os itens 1 e 2, sem usar rede ou destinatários reais.

As tentativas iniciais de consulta de cabeçalhos e análise local de versões foram bloqueadas pelo ambiente e repetidas com o acesso necessário, com sucesso. Não restou bloqueio nesses dois exames.

Não houve teste visual autenticado completo nesta revisão, teste de invasão, restauração de backup, entrega real de mensagem, nova geração de IA ou criação/cancelamento de evento real no Google. A integridade completa de todos os dados históricos e as regras de proteção da branch não foram atestadas. Os resultados de leitura do banco representam o momento da consulta.

Ordem recomendada: reserva de envio e cursor de automações; validade dos lembretes; consistência 1:1; políticas de materiais; salvamento do caderno; demais itens da prioridade 2. Depois, executar um teste acompanhado de ponta a ponta com destinatário e horário de teste autorizados.
