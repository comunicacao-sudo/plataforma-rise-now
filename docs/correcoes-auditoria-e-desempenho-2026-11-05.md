# Correções da auditoria, desempenho e tema claro

## Alterações

- **WhatsApp:** a reserva de uma mensagem muda seu estado para `processing`. Outra execução não consegue reservá-la novamente. Perda de resposta ou interrupção não provoca reenvio automático com resultado incerto; o histórico pede conferência. Rejeição explícita por limite de envios permite nova tentativa.
- **Recuperação:** erros de consultas interrompem a automação, preservando o cursor. Cursores já inicializados não perdem eventos por um corte fixo de seis horas. Avisos ligados a encontros têm vencimento e horário de origem, conferidos novamente antes de enviar. Cancelamento, remarcação, automação desligada e restrição de público bloqueiam a fila antiga.
- **Agenda 1:1:** criação do encontro e confirmação da reserva são uma transação. Cancelamento remove o encontro e registra a exclusão Google numa fila durável na mesma transação. Falhas do Google ficam recuperáveis pelo cron. Eventos têm identificador determinístico para compensar também perda de resposta. Reservas incompletas antigas são recuperadas.
- **Vagas 1:1:** os avisos consultam regras, antecedência, reservas, exceções e disponibilidade da mentora no Google. A mesma função calcula os horários do painel e dos avisos. A abertura é registrada por revisão, permitindo uma reabertura no mesmo dia sem repetir um aviso já registrado. A implantação preserva as ofertas existentes, sem disparo retroativo em massa.
- **Grupo:** cronograma geral e mensagens coletivas filtram encontros destinados a todas. Encontros restritos não são enviados ao grupo geral por esses caminhos.
- **Materiais:** acesso a material de aula depende do acesso à aula, programa, matrícula ativa e mês liberado. O Storage usa a mesma visibilidade da tabela. Helpers de privilégios verificam conta aprovada; o helper de matrícula exige matrícula ativa.
- **Caderno:** rascunho é mantido na sessão do navegador por usuário e aula. Gravações continuam na troca de tela, são serializadas também entre remontagens e podem recuperar uma falha anterior. Há salvamento ao sair do campo e ao ocultar a página.
- **IA:** cotas atômicas limitam abertura de novos mapeamentos e tentativas de regeneração. Repetir uma conclusão já salva recupera as escritas de progresso, em vez de pular essa etapa após uma falha parcial.
- **Migrações:** configuração Drizzle exige `SUPABASE_DB_URL` do projeto oficial. A verificação de alvo passou de aviso a erro para configurações divergentes.
- **Dependências:** versões afetadas foram atualizadas, incluindo ferramentas transitivas. A consulta pública ao npm, comparada às versões exatas do lockfile por intervalo semântico, não retornou alertas aplicáveis nos 490 nomes de pacotes consultados. Isso não equivale a garantia de ausência de vulnerabilidades desconhecidas. O prazo de segurança de 24 horas foi preservado; uma versão do Vite recente demais foi substituída por uma versão corrigida já elegível.

## Carregamento

Editores, calendário, painel WhatsApp e mapeamento passam a carregar por demanda, com indicador localizado e preservação do restante da página. Consultas compartilhadas da jornada têm cache curto, mantendo a atualização periódica. A fonte decorativa passou a ser hospedada localmente, com licença incluída, eliminando a folha de estilo externa do Google Fonts. Arquivos com hash têm cache imutável e o servidor recebe preconexão ao Supabase.

| Medida do build | Antes | Depois |
|---|---:|---:|
| Arquivo principal da área autenticada, sem compressão | 341.875 bytes | aproximadamente 186.740 bytes |
| Entrada pública, gzip | 114.763 bytes | aproximadamente 106.268 bytes |
| JS e CSS completos, gzip | 317.115 bytes | aproximadamente 317.743 bytes |

O total completo fica praticamente igual; a melhora principal é baixar menos código na primeira abertura e carregar o restante quando necessário. Esses números representam peso de arquivos, não porcentagem garantida de redução do tempo de espera. Novos limites de build impedem que a entrada pública ultrapasse 110 KB gzip ou que a entrada autenticada ultrapasse 55 KB gzip.

A construção local encontrou um defeito do adaptador de caminhos no Windows. Um hook restrito ao build no Windows normaliza o import gerado, sem modificar dependências ou código publicado. A pré-renderização voltou a concluir.

## Tema claro em celular e desktop

Textos claros fixos ganharam tokens com contraste adequado no tema claro, mantendo os fallbacks do tema escuro. Foram revisados menu do perfil, ícones, formulários, rótulos, mensagens, cartões, agenda, navegação, caderno, modais e áreas de mapeamento. A cor de destaque do tema claro ficou mais escura para manter a leitura sobre branco e areia. O menu do perfil tem ações legíveis, área de toque maior e largura limitada à tela.

Os testes com dados simulados cobrem 36 combinações de tela e estado, incluindo perfis de administração e mentorada, em 1366 × 900 e 390 × 844. A última execução de contraste não encontrou violações automáticas nem rolagem horizontal. Outros 24 cenários de páginas públicas, login e recuperação de senha simulada foram conferidos no endereço publicado, nos dois temas e tamanhos, sem violações de contraste ou erros de renderização. Isso cobre os estados exercitados; não substitui a inspeção de todos os conteúdos reais cadastrados.

O primeiro servidor estático de testes servia apenas `_shell.html`, provocando um aviso de hidratação que não representava a hospedagem. A verificação foi adaptada para chamar o servidor realmente gerado pelo build.

## Verificação do banco e do servidor

A migração `20261106004751_reliability_access_and_performance.sql` foi aplicada no projeto oficial. Antes disso, migração e verificações foram executadas dentro de uma transação revertida: confirmação e cancelamento, ausência de encontro órfão, fila de exclusão Google, idempotência, reabertura de vagas, cota de tentativas, permissões dos RPCs e bloqueio de aulas e materiais futuros. Nenhum evento foi criado no Google nem mensagem de teste enviada.

As tabelas de operação são exclusivas do servidor, com RLS habilitado e sem grants para `anon` ou `authenticated`. Por isso o advisor pode informar que elas não têm políticas: a ausência de acesso direto é intencional. A função de consulta de papéis continua callable por usuários autenticados, conforme seu uso pelas políticas; o alerta correspondente exige interpretação e não foi mascarado.

A usuária ativou a proteção de senhas vazadas no painel. O advisor foi consultado novamente e o alerta deixou de aparecer.

As funções `rise-backend` e `rise-cron` foram publicadas no projeto oficial, com validação Deno concluída. As execuções recentes examinadas do cron retornaram HTTP 200 e sessão WhatsApp pronta, sem mensagens de teste. Os testes automatizados passaram a 85, incluindo concorrência, resposta perdida, preservação do cursor, validade de lembretes, filas de gravação e recuperação de cancelamento Google. O lembrete de um dia expira até trinta minutos depois do momento previsto, em vez de poder sair muitas horas atrasado; o link na hora tem tolerância de cinco minutos. Falha de uma automação preserva seu cursor e permite entregar os demais avisos válidos.

O commit principal `f976108` foi enviado à main, passou na verificação automática do GitHub e foi publicado. Na conferência do endereço oficial, as dependências externas de fonte deixaram de aparecer no HTML. A hospedagem não aplicava os cabeçalhos de `_headers` ao HTML dinâmico; a proteção foi acrescentada também à configuração nativa do servidor, preservando a incorporação pelo editor Lovable.

Na simulação de carregamento pelo mesmo endereço público, com viewport 390 × 844, CPU limitada em quatro vezes, latência de 60 ms e download de 250.000 bytes/s, duas leituras anteriores registraram LCP de 8.244 e 9.088 ms. Três leituras depois da publicação registraram 3.428, 3.504 e 3.768 ms. São amostras de laboratório, com contexto de navegador novo em cada visita; não representam medições de todos os usuários. A comparação com um servidor local foi excluída dessa conclusão.

Não foram feitos novos diagnósticos reais de IA nem testes de entrega com destinatários reais. Resultados de laboratório e de build não garantem o mesmo tempo de carregamento em todas as conexões e aparelhos.
