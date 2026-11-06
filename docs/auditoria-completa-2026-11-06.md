# Auditoria técnica da RISE NOW — 06/11/2026

## Escopo e resultado

A revisão examinou a plataforma publicada, o aplicativo instalável, código, permissões do banco e do Storage, funções do servidor, tarefas automáticas, agenda, materiais, questionários, planos de desenvolvimento, dependências, contraste e carregamento. Os defeitos confirmados abaixo foram corrigidos. As validações operacionais e os limites estão separados dos testes com dados simulados.

O repositório e a versão publicada estavam sincronizados em `708d0c5` no início. A primeira publicação desta revisão foi `4530f41`, com o tutorial e a correção do cronograma semanal. O projeto oficial consultado foi `riakceytqrlvdcgcwfdx`.

## Correções

### Cronograma semanal: repetição de cadastro interrompia a automação

Os registros mostraram erros HTTP 500 nas execuções seguintes ao primeiro aviso semanal. A camada de consultas verificadas lançava a exceção de unicidade antes de o código conseguir tratar a notificação já existente. A consulta passou a usar conflito ignorado pela chave de idempotência, sem atualizar a mensagem ou seu estado, e a retornar `null` para um aviso já registrado.

O teste reproduz a sequência com a mesma camada de banco usada pela automação: uma linha permanece e o texto original não é sobrescrito. Depois da publicação, execuções normais do cron voltaram a HTTP 200. O único aviso registrado como enviado continuou sendo o já existente; nenhum teste enviou uma nova mensagem a destinatários reais. O campo de envio no banco não comprova leitura ou recebimento no aparelho.

### Isolamento entre contas e recuperação de conexão

Com autenticação inteiramente simulada, sair de uma conta e entrar em outra reproduziu o nome da conta anterior na interface enquanto a nova consulta estava pendente. O cache privado agora é removido na saída ou mudança de identidade, e a área autenticada é remontada por conta. Respostas antigas canceladas não repovoam o cache. Atualizações assíncronas de foto, tema e perfil conferem a conta proprietária antes de alterar o cache.

O teste anterior exibiu `Pessoa de teste` após entrar como `Conta B`; a versão corrigida exibiu `Conta B`. Isso é evidência de reprodução em simulação, não de exposição observada de dados de clientes.

Uma falha temporária nas consultas de acesso também podia encerrar a sessão. A verificação agora distingue indisponibilidade de acesso efetivamente negado. Na primeira abertura, apresenta nova tentativa; ao retornar a uma sessão já validada, não a encerra por uma falha de rede. A trilha deixa de tratar erros de matrícula, progresso e entregas como respostas vazias. A biblioteca conserva seus cartões já carregados e oferece nova tentativa quando a carga inicial falha.

### Revogação, arquivamento e permissões

Uma verificação central consulta a identidade mantida pelo Auth, o convite, o papel, o arquivamento, a exclusão e o bloqueio da conta. Ela é aplicada ao backend e como restrição adicional nas 38 tabelas públicas acessíveis pelo navegador e no Storage. As políticas anteriores continuam definindo quais linhas cada pessoa pode acessar; a nova restrição não amplia nenhuma permissão.

As consultas sob os papéis reais de banco mantiveram os mesmos resultados autorizados antes e depois: mentorado com um perfil, uma matrícula e um material elegível; administração com onze perfis, sete matrículas e um material. O mentorado não leu notas privadas de terceiros. Um identificador sem conta retornou acesso falso e zero registros privados. O visitante anônimo não leu objetos de buckets privados.

Foram removidos os privilégios de tabela `TRUNCATE`, `TRIGGER`, `REFERENCES` e `MAINTAIN` dos papéis de navegador. Não foi demonstrado um caminho de exploração desses privilégios pela API; eram permissões excessivas e não são protegidas por RLS. O visitante deixou de ter grants nas tabelas públicas. Os 150 grants de leitura/escrita existentes da conta autenticada foram preservados. Novas tabelas criadas pelo papel de migração `postgres` passam a exigir grants explícitos; criações por papéis internos do provedor continuam exigindo revisão de permissões.

Tokens ainda válidos não dispensam a verificação atual de acesso nas novas operações. URLs assinadas já emitidas e cópias já recebidas pelo dispositivo continuam sujeitas ao seu prazo de validade; esta alteração não tenta retirar conteúdo que já foi baixado.

### Questionários futuros e falhas de arquivos

A resposta da biblioteca omite agora também o identificador e o objeto de perguntas de uma etapa bloqueada por mês ou data. Antes, o link era ocultado, mas esses campos podiam ser incluídos no JSON. O acesso direto à tabela de conteúdos de etapas já era exclusivo do backend. Dois testes conferem o bloqueio futuro e a liberação correta. Não foi demonstrado acesso indevido a perguntas reais em produção.

Falhas ao consultar pilares, versões e progresso ou preparar arquivos assinados passam a ser reportadas, em vez de aparentarem conteúdo ausente ou progresso vazio.

### Plano e observações privadas

O plano de desenvolvimento e sua observação privada eram gravados em operações separadas. A nova RPC exclusiva do servidor salva ambos na mesma transação, valida o vínculo da aplicação com a matrícula e o papel da autora. Uma falha na segunda escrita não deixa um plano parcial.

Uma execução em transação revertida confirmou a criação do plano e da observação juntos. Após a reversão, ambas as tabelas continuaram sem registros de teste. A RPC não pode ser executada por `anon` ou `authenticated`. Não foi gerado diagnóstico de IA nesse procedimento.

### Interface, aplicativo e tutorial

A página pública [Instalar aplicativo](https://board.mentoriarisenow.com.br/instalar) reúne os passos para Android, iPhone/iPad e computador e orienta quem abriu o link pelo WhatsApp. O início do aplicativo instalado continua sendo a plataforma.

A revisão visual encontrou baixo contraste nos códigos de cor do seletor de tema, na aba ativa de acessos e numa orientação do perfil no tema escuro. Os códigos técnicos foram retirados do seletor e os contrastes foram ajustados. A tela de falha do servidor também passou a português.

O app continua guardando no cache próprio somente a tela pública sem conexão e dois ícones. Páginas autenticadas, respostas, APIs, capas privadas e vídeos não foram incluídos nesse cache. Os endpoints antigos de WhatsApp e de importação foram conferidos: ambos permanecem desativados com resposta 410.

## Carregamento

- A entrada usa uma única marca selecionada pelo tema no CSS, evitando baixar a imagem do tema oculto. No tema escuro, a imagem evitada tem 25.506 bytes; no claro, 14.432 bytes. As artes originais foram mantidas.
- O registro inicial do service worker foi transferido para depois da carga da página, com pequena espera, para o cache público não disputar a primeira abertura com recursos visíveis. Não há recarga automática que descarte formulários.
- Os eventos simultâneos de foco e visibilidade passaram de duas verificações completas de acesso para uma no teste de navegador. Cada verificação reúne as mesmas três consultas de perfil, papel e convite; a checagem não foi removida.
- O cache da mesma identidade continua válido nas renovações de token. Ele é limpo quando muda a conta, sem reaproveitar dados privados entre pessoas.

Amostras anteriores à otimização, no mesmo domínio público, com contexto novo, viewport 390 × 844, CPU limitada em quatro vezes, latência de 60 ms e download de 250.000 bytes/s: LCP de **4.360, 4.376 e 3.996 ms**, mediana **4.360 ms**; CLS em torno de **0,006**. Os resultados posteriores à publicação serão registrados na conferência final desta revisão. Comparações com o servidor local não são usadas como ganho de tempo.

Essas são medições de laboratório, não percentis de todos os usuários nem uma medição de INP em uso real. Variações de rede, aparelho e hospedagem afetam os números. A redução anterior de cerca de 95% no peso das capas permanece publicada, com os originais preservados.

## Evidências de validação

- 104 testes automatizados passaram, incluindo concorrência, idempotência, cancelamento e recuperação, consentimento, bloqueio de conteúdo futuro e isolamento de cache.
- Tipos, lint e compilação passaram. Os doze avisos de Fast Refresh já existentes não são falhas de lint.
- 72 estados internos foram exercitados com dados simulados, nos perfis de administração e mentorado, em desktop/celular e nos dois temas. A rodada final não apresentou falhas nas regras de contraste examinadas, rolagem horizontal indevida ou erros de execução da página.
- 28 cenários públicos foram conferidos no endereço oficial, incluindo recuperação de senha simulada e o tutorial.
- 14 cenários do PWA e quatro combinações de tema/largura do tutorial passaram. O Chromium aceitou o manifesto sem erro de instalabilidade, e a queda/retorno da conexão funcionou.
- O teste de troca de conta reproduziu o problema anterior e confirmou a correção. Também confirmou nova tentativa após indisponibilidade inicial e preservação da sessão em falha posterior.
- Migrações foram aplicadas no banco oficial e verificadas por consultas. Não houve alteração permanente de contas ou conteúdo de clientes nos testes.
- A consulta de integridade encontrou zero reservas confirmadas sem encontro, zero materiais sem fonte e zero referências de capa sem arquivo.
- A verificação dos 490 nomes de pacotes do lockfile no registro npm não retornou avisos aplicáveis. A varredura do artefato público não encontrou os padrões de chaves secretas ou JWT de `service_role` examinados; ela não substitui todos os tipos possíveis de análise de segredos.

## Avisos e limites

O advisor de saúde não apresentou avisos. Os sete avisos informativos de RLS sem política correspondem a tabelas exclusivas do servidor, sem grants de navegador. O aviso da função de consulta de papéis foi revisado: ela retorna um booleano, é necessária às políticas e não concede operações administrativas. Não foi ocultado. [Descrição do aviso de função](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS sem política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

O advisor de desempenho lista cinco FKs sem índice, índices ainda não usados e a estratégia fixa de conexões do Auth. As tabelas envolvidas são pequenas e não foi demonstrado gargalo que justificasse criar/remover índices ou alterar a capacidade do servidor para zerar o painel. [Índices de FKs](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

Não foram executados teste de invasão, restauração de backup, nova geração real de IA ou criação/cancelamento de evento real no Google. Os testes do convite de instalação e de identificação de iPhone/Android usam simulação em Chromium; não equivalem a instalar fisicamente nesses aparelhos. O recebimento de todos os tipos de aviso em um número de teste continua sendo uma homologação operacional separada. A auditoria técnica não é uma garantia de ausência de qualquer erro futuro.

Referências de método: [RLS e grants](https://supabase.com/docs/guides/database/postgres/row-level-security), [registro do service worker após a carga](https://web.dev/articles/service-workers-registration), [Web Vitals e medições](https://web.dev/articles/vitals).
