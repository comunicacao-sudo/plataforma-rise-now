# Limpeza definitiva do Lovable Cloud antigo

## Alvo da limpeza
- Backend antigo do Lovable Cloud: **vfkvdkqjwnmhxhlfrqba**. Não é `riakceytqrlvdcgcwfdx`.
- O banco oficial `riakceytqrlvdcgcwfdx`, o GitHub, o código, o domínio e a publicação não serão alterados.

## Etapa 1: auditoria final (só leitura)
1. Conferir que a conexão de banco aqui é a `vfkv…`. Se for outra, eu paro.
2. Contar: contas de login, perfis, papéis, e-mails aprovados, matrículas, progresso, entregas, questionários, histórico, etapas da trilha, avisos, notas, metas RISE 90, materiais e arquivos guardados (por bucket e pasta).
3. Comparar com a auditoria anterior (9 perfis, 4 papéis, 9 e-mails, 2 matrículas, 1 progresso, 59 histórico, 116 etapas, 31 arquivos).
4. Baixar o site publicado (board.mentoriarisenow.com.br) e conferir que os arquivos só citam `riakceytqrlvdcgcwfdx`. Fazer uma entrada de teste e ver que nenhuma chamada vai para o banco antigo.
5. Preservação no banco oficial: eu não tenho acesso ao banco oficial. Para as 23 capas, a RISE Decision Room e o avatar, uso a sua confirmação de que a migração foi feita e validada. Se der, também abro o site publicado para ver se as capas carregam de lá.
6. Se alguma contagem mostrar dado novo, com cara de real (aluna de fora, entrega nova), eu paro e te mostro antes de apagar.

## Etapa 2: exclusão (só se a Etapa 1 passar)
- Apagar todos os arquivos dos buckets antigos (journey-content, avatars, materials e outros) e conferir que ficaram vazios. Os buckets continuam existindo, mas vazios.
- Apagar as linhas de todas as tabelas de dados (matrículas, progresso, entregas, questionários, histórico, trilha, avisos, notas, metas, e-mails aprovados, papéis, perfis e as outras).
- Excluir todas as contas de login do Lovable Cloud antigo.
- Ficam no lugar: tabelas, regras de acesso e configurações, todas vazias. Assim o editor e a publicação do Lovable continuam funcionando.

## Etapa 3: conferência e relatório
- Refazer as contagens (o resultado esperado é zero) e mostrar o ANTES e o DEPOIS.
- Abrir o site publicado (HTTP 200), entrar com uma conta de teste, abrir uma área logada e confirmar que todas as chamadas vão para `riakceytqrlvdcgcwfdx`.
- Para o teste de login, preciso de uma conta no banco oficial. Sem ela, testo só até a tela de acesso e aviso que essa parte ficou sem conferência.

## Detalhes técnicos
- Contagens com psql e read_query. A exclusão de linhas passa pela ferramenta de dados (DELETE por tabela, com WHERE), sem migration e sem DROP. Os arquivos saem pela API de Storage com a chave de serviço do projeto antigo. As contas saem pela API admin de Auth, uma a uma.
- A ordem respeita as chaves estrangeiras: primeiro as tabelas filhas, depois profiles e por último auth.users.
- Nenhum arquivo do repositório muda, a não ser este plano.
