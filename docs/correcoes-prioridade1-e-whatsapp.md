# Correções da jornada e autorização de WhatsApp

## Jornada

A Turma 1, 2026 começa em 16/10/2026, conforme confirmado pela administração. O mês avança no aniversário mensal: mês 2 em 16/11/2026, até o mês 6. A rotina `refresh_journey_months` roda no agendamento existente e aceita início individual quando houver exceção.

A conclusão automática passa a registrar o avanço em `journey_step_progress`. A função do banco verifica a versão atribuída à matrícula, a regra de conclusão e o progresso já salvo. Etapas que exigem confirmação da mentora não são concluídas por esse caminho.

No mapeamento, respostas confirmadas são mantidas ao voltar e ao atualizar dados da tela. Salvar e sair grava a seleção atual. Uma falha mantém o conteúdo e permite nova tentativa. A etapa informada na conclusão precisa pertencer à matrícula e ser um mapeamento comportamental.

A geração por IA mantém `background: true` e `store: false`: a documentação atual permite essa combinação com retenção temporária para consultas. Foram adicionados tratamento de erros e recuperação de gerações pendentes antigas. Relatórios existentes não são regenerados automaticamente.

O RISE 90 e o caderno agora mostram erros de gravação. O caderno serializa salvamentos, permite tentar novamente e evita substituir o texto por respostas de carregamentos antigos.

## Gabriela

O cadastro existente de Gabriela Ribeiro usa `comunicacao@pamarisdigital.com`. As referências do servidor, do conteúdo de apresentação e da função interna do diretório foram corrigidas para esse endereço, sem criar uma segunda conta.

## WhatsApp: telefone e autorização

Em **WhatsApp → Contatos e autorização de WhatsApp**, a equipe pode buscar uma pessoa, cadastrar o telefone, registrar ou retirar o aceite. Os dados são salvos em transação, com quem registrou e quando. Um histórico preserva cada alteração.

Nenhum número existente recebe autorização automaticamente. O aceite vale para o número confirmado. Trocar o número exige novo aceite. A retirada bloqueia mensagens privadas pendentes. O servidor confere novamente a autorização e o telefone atual antes do envio, além de conferir ao entrar na fila.

Os avisos de grupo continuam vinculados ao grupo escolhido. A autorização individual controla mensagens privadas. Testes manuais seguem o campo próprio destinado a um telefone que espera receber o teste.

## Verificação

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Testes de autorização cobrem ausência de aceite, troca de telefone, revogação e bloqueio antes de acessar o gateway.
- `scripts/verify-priority1.sql` verifica limites de mês, permissões, aceite, revogação, histórico e diretório. O teste roda em transação com `ROLLBACK`.
- Migração consolidada: `supabase/migrations/20261105180409_whatsapp_contact_permissions_and_directory.sql`, reunindo as mudanças 0046–0048 documentadas em `drizzle/migrations`.

## Publicação

As funções `rise-backend` e `rise-cron` precisam ser publicadas no projeto oficial `riakceytqrlvdcgcwfdx`. O site deve ser atualizado pelo projeto Lovable da RISE NOW após a sincronização com a `main`. Não apontar o site para o banco interno do Lovable.
