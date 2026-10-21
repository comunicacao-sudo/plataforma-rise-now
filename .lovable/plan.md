# Limpeza das contas antigas do Lovable Cloud

## O que já conferi
- O banco do Lovable Cloud tem 9 perfis de pessoas (as mesmas contas da equipe e a Comunicação), 2 matrículas, 1 foto de perfil e 30 arquivos de conteúdo da trilha.
- Não encontrei entregas nem metas do RISE 90 nesse banco.
- Ainda não confirmei qual banco o site publicado usa. A primeira busca nos arquivos do site não achou nenhum dos dois endereços.

## Etapa 1: auditoria (nada é apagado)
1. Abrir o site publicado (board.mentoriarisenow.com.br) e conferir em todos os arquivos dele que o único banco usado é o riakceytqrlvdcgcwfdx e que o banco antigo não aparece em nenhum lugar.
2. Fazer um login de teste no site publicado e confirmar que a entrada acontece no banco oficial.
3. Listar as contas antigas do Lovable Cloud e tudo o que está ligado a elas: perfis, papéis, matrículas, notas, avisos, histórico e arquivos (a foto e os 30 arquivos da trilha).
4. Conferir que essas contas são só contas de login da plataforma, e não pessoas que editam o projeto. A exclusão não mexe na equipe do Lovable.
5. Levar o resultado para você **antes de apagar**. Os 30 arquivos da trilha e as 2 matrículas podem ser os únicos exemplares, caso não tenham sido copiados para o banco oficial. Nesse caso, você decide.

## Etapa 2: exclusão (só se a Etapa 1 confirmar tudo)
- Excluir somente as contas de login do Lovable Cloud. Os dados ligados a elas nesse banco antigo também saem.
- Não vou tocar no banco oficial nem na configuração da plataforma, não vou migrar nada e não vou remover pessoas da equipe do projeto.
- No fim, informar quantas contas foram excluídas e testar de novo o login no site publicado.

## Detalhes técnicos
- A verificação do site será feita pelos arquivos JS publicados e pelos pedidos de rede de um login feito com o Playwright, conferindo o host de autenticação.
- A exclusão será feita pela API administrativa de autenticação do projeto Lovable Cloud (vfkv…). As linhas de `profiles` e de `user_roles` saem em cascata.
- O banco riakceytqrlvdcgcwfdx não recebe nenhuma escrita.
