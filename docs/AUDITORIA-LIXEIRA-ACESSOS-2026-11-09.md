# Auditoria de lixeira e gestão de acessos — 09/11/2026

As exclusões da RISE passam a exigir a confirmação do e-mail e da senha da conta conectada e a manter os registros recuperáveis por 30 dias. A gestão de acessos sinaliza possíveis duplicidades para revisão humana. A implementação foi comparada com a referência do Clube do Empresário Caro, preservando a identidade e a estrutura da RISE.

## Comportamento entregue

- Lixeira em **Turmas e acessos → Lixeira** para a equipe. Metas e marcos pessoais têm recuperação na área RISE 90 do próprio participante.
- Acessos, turmas vazias, conteúdos da jornada, materiais, automações, encontros, disponibilidades 1:1, metas, marcos e etapas removidas de rascunhos usam exclusão protegida.
- Um acesso excluído perde suas sessões e sua autorização imediatamente. Perfil, histórico e matrícula ficam preservados durante a recuperação. A restauração mantém o estado anterior da matrícula, inclusive quando estava pausada.
- O próprio acesso e o último acesso administrativo ativo são protegidos. Turmas com pessoas, aulas, encontros ou outros vínculos devem ser reorganizadas antes da exclusão.
- Remover uma etapa de um rascunho exige confirmação ao salvar ou publicar. A recuperação mantém suas frases, campos e chave estável; a etapa retorna ao rascunho para revisão e publicação.
- Automações recuperadas voltam desligadas. Encontros recuperados voltam à RISE sem recriar automaticamente convites do Google Agenda. Cancelar uma reserva continua sendo uma ação de agenda e preserva o histórico do encontro.
- A lista de possíveis duplicados explica os indícios: nome completo, telefone/WhatsApp, e-mail ou nomes muito próximos na mesma turma. Nenhuma conta é mesclada ou excluída automaticamente.

## Segurança e retenção

A senha é verificada pelo Supabase Auth em uma sessão temporária isolada, encerrada sem desconectar a sessão original. A confirmação gera uma autorização aleatória de uso único, válida por dois minutos e vinculada à pessoa, sessão, recurso e operação. O banco armazena somente seu hash. Há limite de cinco tentativas em 15 minutos.

As permissões e a sessão são conferidas novamente pelo banco ao consumir a autorização. Exclusões diretas nas tabelas gerenciadas e alterações diretas dos marcadores de lixeira ficam bloqueadas. As tabelas de lixeira, confirmações, tentativas e limpeza têm RLS e não concedem leitura ao cliente. A RPC de metadados de acesso é exclusiva do servidor.

O agendamento existente, ativo a cada cinco minutos, executa a retenção mesmo quando o WhatsApp está desligado. Após o prazo, remove os registros vencidos e enfileira seus arquivos exclusivos. Dependências ainda recuperáveis são preservadas. Falhas recebem novas tentativas, sem impedir a limpeza dos demais itens. A auditoria da conta apagada mantém o registro da operação sem suas cópias completas de cadastro.

Arquivos do Supabase são removidos pela API de Storage. No R2, o Worker recebe um recibo temporário e obtém do servidor a única chave autorizada, sem aceitar um alvo escolhido pelo cliente. A rota antiga `/object/delete` responde 409. Arquivos referenciados por outros conteúdos ou versões são preservados. Originais externos, incluindo gravações do Google Drive, permanecem nesses serviços.

## Verificações realizadas

- **137 testes automatizados aprovados**, incluindo duplicidades, senha incorreta, escopo, isolamento da sessão temporária, recibos de limpeza, falhas e novas tentativas.
- TypeScript sem erros; ESLint sem erros, com 12 avisos existentes de organização de componentes; três Edge Functions verificadas pelo Deno.
- Teste transacional em `supabase/tests/protected-trash.sql`: autorização, prova vencida, sessão incorreta, uso único, exclusão e recuperação, proteção do próprio acesso, turma vinculada, preservação das frases, propriedade de metas, revogação de sessões, estado anterior da matrícula, prazo de retenção, arquivos compartilhados, minimização da auditoria e isolamento das conexões de outras contas. **Todas as fixtures foram revertidas.**
- **16 verificações visuais**: duplicidades, confirmação de identidade, lixeira preenchida e lixeira vazia em 390 e 1366 pixels, nos temas claro e escuro. Sem falhas de contraste ou largura horizontal nas telas verificadas. Cancelamento, senha errada/correta, limpeza da senha entre operações, item vencido e recuperação passaram. A lixeira usa uma superfície sólida para preservar a leitura sobre o fundo decorativo da plataforma.
- Worker completo testado com serviços simulados, preservando saúde, autenticação do upload e recusa de mídia sem ticket. Em produção: `/health` 200; exclusão antiga 409; recibo inválido no Worker e na Edge Function 403. Nenhum arquivo real foi apagado para teste.
- Três migrações aplicadas no projeto de produção `riakceytqrlvdcgcwfdx`; `rise-backend`, `rise-media` e `rise-cron` publicados; Worker R2 atualizado, versão ativa `6fe24427`.

## Desempenho e avisos do banco

A lixeira carrega por demanda, em páginas de 50 itens. A limpeza processa lotes limitados e não faz parte do carregamento de uma página. A gestão de acessos busca somente os metadados de autenticação dos cadastros da plataforma, removendo a antiga limitação de uma página de mil usuários. Consultas independentes continuam paralelas e o resultado usa um mapa por e-mail.

O build final ficou em **338.103 bytes gzip** de JS/CSS; entrada pública **106.991 bytes** e entrada autenticada **53.450 bytes**, dentro dos limites de desempenho do projeto. Esses números verificam o tamanho entregue; não representam uma medição de velocidade da conexão dos participantes.

Os assessores do Supabase não apontaram novo aviso de segurança além dos informativos esperados para tabelas exclusivas do servidor. Permanece o aviso existente sobre `has_role`, predicado deliberadamente usado nas políticas de acesso, com execução autenticada. Os avisos de desempenho são informativos sobre índices ainda sem uso observado e a estratégia atual de conexões do Auth; não foi removido nenhum índice preventivamente. Referências: [RLS sem políticas em tabelas privadas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [funções com privilégios elevados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [índices sem uso observado](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Limites da validação

A retenção foi exercitada antecipando datas somente em uma transação revertida; não foi necessário aguardar 30 dias nem excluir dados reais. As operações de senha e recuperação na interface foram testadas com credenciais e serviços simulados; não foi solicitada nem usada a senha da usuária. Os originais do Drive não são apagados pela lixeira da RISE. Após o envio da main ao Lovable, o artefato publicado no domínio da RISE foi comparado com o build aprovado. A sessão real de mentora carregou a gestão de acessos e a lixeira; a confirmação de exclusão foi aberta e cancelada, preservando todos os cadastros.
